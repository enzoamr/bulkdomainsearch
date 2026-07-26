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
 * Memory: files are JSON (not NDJSON), so each is parsed whole. The big ones
 * (all_expiring_auctions ~400MB unzipped) may need
 * `node --max-old-space-size=2048`. The defaults below stay modest.
 */

import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

const BASE = "https://inventory.auctions.godaddy.com";
const OUT_DIR = path.join(process.cwd(), "data", "aftermarket");
const OUT_FILE = path.join(OUT_DIR, "godaddy.ndjson");

// Basenames (without .json.zip). Biddable = live auctions; closeouts =
// fixed-price buy-now; ending-today keeps prices fresh. Add
// "all_expiring_auctions" for maximum coverage (heavier).
const DEFAULT_FILES = [
  "all_biddable_auctions",
  "closeout_listings",
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

async function fetchZipJson(basename) {
  const url = `${BASE}/${basename}.json.zip`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const entries = new AdmZip(buf).getEntries().filter((e) => !e.isDirectory);
  if (entries.length === 0) throw new Error(`empty zip: ${basename}`);
  return JSON.parse(entries[0].getData().toString("utf8"));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const tmpPath = `${OUT_FILE}.tmp`;
const out = fs.createWriteStream(tmpPath);
let total = 0;

for (const basename of files) {
  process.stdout.write(`${basename}: downloading… `);
  try {
    const doc = await fetchZipJson(basename);
    const rows = Array.isArray(doc) ? doc : doc.data || [];
    let n = 0;
    for (const r of rows) {
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
      out.write(JSON.stringify(listing) + "\n");
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
