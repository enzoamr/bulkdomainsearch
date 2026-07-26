#!/usr/bin/env node
/**
 * Load the normalized aftermarket feed (data/aftermarket/*.ndjson) into a
 * Turso / libSQL table so a Vercel-hosted app can look listings up without
 * holding the whole index in memory. Run it after
 * scripts/godaddy-auctions-download.mjs, from the nightly GitHub Action.
 *
 * Env: TURSO_DATABASE_URL (required), TURSO_AUTH_TOKEN (required for remote;
 * omit for a local `file:...` URL). Test locally with:
 *   TURSO_DATABASE_URL=file:./local.db node scripts/turso-load.mjs
 *
 * Each nightly run rebuilds the table (DELETE + insert) so ended auctions
 * drop off. ~350k rows ≈ ~10M writes/month — around Turso's free write cap;
 * trim the file set in godaddy-auctions-download.mjs or take the $4.99 plan
 * if you exceed it.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error("TURSO_DATABASE_URL is required.");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const DIR = path.join(process.cwd(), "data", "aftermarket");
const BATCH = 500;

async function main() {
  await client.execute(
    "CREATE TABLE IF NOT EXISTS listings (domain TEXT PRIMARY KEY, data TEXT NOT NULL)",
  );
  await client.execute("DELETE FROM listings");

  const files = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter((f) => f.endsWith(".ndjson"))
    : [];
  if (files.length === 0) {
    console.log("No .ndjson files in data/aftermarket — nothing to load.");
    return;
  }

  let total = 0;
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    await client.batch(batch, "write");
    total += batch.length;
    batch = [];
    process.stdout.write(`\r${total.toLocaleString()} rows loaded…`);
  };

  for (const file of files) {
    const rl = readline.createInterface({
      input: fs.createReadStream(path.join(DIR, file)),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        continue;
      }
      const { domain, ...listing } = rec;
      if (!domain) continue;
      batch.push({
        sql: "INSERT OR REPLACE INTO listings (domain, data) VALUES (?, ?)",
        args: [String(domain).toLowerCase(), JSON.stringify(listing)],
      });
      if (batch.length >= BATCH) await flush();
    }
  }
  await flush();
  console.log(`\n${total.toLocaleString()} listings → Turso table 'listings'.`);
}

main()
  .then(() => client.close())
  .catch((err) => {
    console.error(`\nturso-load failed: ${err.message}`);
    client.close();
    process.exit(1);
  });
