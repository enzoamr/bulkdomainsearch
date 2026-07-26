#!/usr/bin/env node
/**
 * Nightly aftermarket sync from GoDaddy Auctions — the free half of the blue
 * tier. GoDaddy publishes its entire auction/closeout/expiring inventory as
 * daily ZIP files at https://inventory.auctions.godaddy.com/ with NO key and
 * NO account required. We download the useful ones, normalize each listing,
 * and write data/aftermarket/godaddy.ndjson, which lib/aftermarket-index.ts
 * serves from memory with an O(1) lookup — same shape as the zone-file index.
 *
 * Run: node scripts/godaddy-auctions-download.mjs [file ...]
 *   With no args it pulls the default set below. Pass file basenames to
 *   override, e.g. `node scripts/godaddy-auctions-download.mjs closeout_listings`.
 *
 * Schedule nightly (files rebuild ~14:30 UTC), e.g.:
 *   45 14 * * * cd /srv/bulkdomainsearch && node scripts/godaddy-auctions-download.mjs
 *
 * The `data` array is streamed out of each zip incrementally (stream-json), so
 * the >512MB files (all_biddable_auctions, all_expiring_auctions) parse fine —
 * loading them as one string blows past Node's max string length and throws.
 */

import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import AdmZip from "adm-zip";
import { chain } from "stream-chain";
import { parser } from "stream-json";
import { pick } from "stream-json/filters/pick.js";
import { streamArray } from "stream-json/streamers/stream-array.js";

const BASE = "https://inventory.auctions.godaddy.com";
const OUT_DIR = path.join(process.cwd(), "data", "aftermarket");
const OUT_FILE = path.join(OUT_DIR, "godaddy.ndjson");

// Basenames (without .json.zip). The full GoDaddy for-sale inventory:
// biddable = every live auction, closeouts = fixed-price buy-now, expiring =
// names dropping to auction soon, ending-today = a fresh subset. Duplicate
// domains across files collapse to one row (domain is the Turso primary key).
const DEFAULT_FILES = [
  "all_biddable_auctions",
  "closeout_listings",
  "all_expiring_auctions",
  "all_listings_ending_today",
];

const wanted = process.argv.slice(2);
const files = (wanted.length > 0 ? wanted : DEFAULT_FILES).map((f) =>
  f.replace(/\.(json|xml)(\.zip)?$/, ""),
);

function parsePrice(raw) {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mapType(auctionType) {
  const t = String(auctionType || "").toLowerCase();
  if (t.includes("closeout")) return "closeout";
  if (t.includes("buy") || t.includes("purchase")) return "buyNow";
  if (t.includes("offer")) return "makeOffer";
  return "auction"; // "Bid" and anything else.
}

/** Yield each element of the zip's top-level `data` array, incrementally. */
async function* streamZipRecords(basename) {
  const url = `${BASE}/${basename}.json.zip`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const entry = new AdmZip(buf).getEntries().find((e) => !e.isDirectory);
  if (!entry) throw new Error(`empty zip: ${basename}`);
  const data = entry.getData();

  // Feed the decompressed bytes to the JSON parser in chunks — never as one
  // giant string. getData() is a Buffer, which may exceed the string limit.
  const src = new Readable({ read() {} });
  const CHUNK = 16 * 1024 * 1024;
  for (let i = 0; i < data.length; i += CHUNK) src.push(data.subarray(i, i + CHUNK));
  src.push(null);

  const pipe = chain([src, parser(), pick({ filter: "data" }), streamArray()]);
  for await (const rec of pipe) yield rec.value;
}

// Backpressure-aware write so a slow disk doesn't balloon memory on 2M+ rows.
function write(stream, line) {
  if (!stream.write(line)) return new Promise((r) => stream.once("drain", r));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const tmpPath = `${OUT_FILE}.tmp`;
const out = fs.createWriteStream(tmpPath);
let total = 0;

for (const basename of files) {
  process.stdout.write(`${basename}: downloading… `);
  try {
    let n = 0;
    for await (const r of streamZipRecords(basename)) {
      const name = (r.domainName || r.domain || "").toLowerCase();
      if (!name || !name.includes(".")) continue;
      const listing = {
        domain: name,
        market: "godaddy-auctions",
        price: parsePrice(r.price),
        currency: "USD",
        type: mapType(r.auctionType),
        url: r.link || `https://www.godaddy.com/domain-auctions/${name}`,
        endsAt: r.auctionEndTime || undefined,
        valuation: parsePrice(r.valuation),
      };
      await write(out, JSON.stringify(listing) + "\n");
      n++;
    }
    total += n;
    console.log(`${n.toLocaleString()} listings`);
  } catch (err) {
    console.log(`skipped (${err.message})`);
  }
}

await new Promise((resolve, reject) => {
  out.end(() => resolve());
  out.on("error", reject);
});
fs.renameSync(tmpPath, OUT_FILE);
console.log(`\n${total.toLocaleString()} listings → data/aftermarket/godaddy.ndjson`);
