#!/usr/bin/env node
/**
 * Nightly zone-file sync from ICANN CZDS (https://czds.icann.org) — the
 * "download a gigantic list of registered names every night" half of the
 * architecture. For each approved zone it downloads the gzipped zone file,
 * extracts the unique registered second-level names, and writes them to
 * data/zones/{tld}.txt, which lib/zone-index.ts serves from memory.
 *
 * Setup:
 *   1. Create a free account at https://czds.icann.org and request access
 *      to the zones you want (.com/.net are granted by Verisign, most other
 *      gTLDs by their registries; approval usually takes a few days).
 *   2. Set CZDS_USERNAME and CZDS_PASSWORD (see .env.example).
 *   3. Run: node scripts/czds-download.mjs [tld ...]
 *      With no arguments, every approved zone is synced.
 *
 * Memory note: names are deduplicated in memory. Small and mid-size TLDs
 * are fine anywhere; the .com zone (~160M names) needs ~16 GB of RAM
 * (run node with --max-old-space-size=24576) or pre-sorting on disk.
 *
 * Schedule it nightly with cron, e.g.:
 *   15 3 * * * cd /srv/bulkdomainsearch && node scripts/czds-download.mjs
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";

const AUTH_URL = "https://account-api.icann.org/api/authenticate";
const LINKS_URL = "https://czds-api.icann.org/czds/downloads/links";
const OUT_DIR = path.join(process.cwd(), "data", "zones");

const username = process.env.CZDS_USERNAME;
const password = process.env.CZDS_PASSWORD;
if (!username || !password) {
  console.error("Set CZDS_USERNAME and CZDS_PASSWORD (see .env.example).");
  process.exit(1);
}

const wantedTlds = process.argv.slice(2).map((t) => t.toLowerCase().replace(/^\./, ""));

async function authenticate() {
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`CZDS auth failed: HTTP ${res.status}`);
  const { accessToken } = await res.json();
  return accessToken;
}

async function listZoneLinks(token) {
  const res = await fetch(LINKS_URL, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`CZDS links failed: HTTP ${res.status}`);
  return res.json();
}

/** Extract unique second-level names from a zone-file stream for `tld`. */
async function extractNames(stream, tld) {
  const names = new Set();
  const suffix = `.${tld}.`;
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.startsWith(";")) continue;
    const owner = line.split(/\s+/, 1)[0].toLowerCase();
    if (!owner.endsWith(suffix)) continue;
    const name = owner.slice(0, -suffix.length);
    // Zone files list every delegated node; keep only second-level names.
    if (name && !name.includes(".")) names.add(name);
  }
  return names;
}

async function downloadZone(token, url) {
  const tld = path.basename(new URL(url).pathname).replace(/\.zone$/, "");
  if (wantedTlds.length > 0 && !wantedTlds.includes(tld)) return;

  process.stdout.write(`${tld}: downloading… `);
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok || !res.body) {
    console.log(`skipped (HTTP ${res.status})`);
    return;
  }

  const gunzip = createGunzip();
  Readable.fromWeb(res.body).pipe(gunzip);
  const names = await extractNames(gunzip, tld);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${tld}.txt`);
  const tmpPath = `${outPath}.tmp`;
  const out = fs.createWriteStream(tmpPath);
  for (const name of names) out.write(name + "\n");
  await new Promise((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });
  fs.renameSync(tmpPath, outPath);
  console.log(`${names.size.toLocaleString()} names → data/zones/${tld}.txt`);
}

const token = await authenticate();
const links = await listZoneLinks(token);
console.log(`${links.length} approved zone(s) available.`);
for (const url of links) {
  try {
    await downloadZone(token, url);
  } catch (err) {
    console.error(`error on ${url}: ${err.message}`);
  }
}
