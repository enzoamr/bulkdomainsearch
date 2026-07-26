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
// Bigger batches = fewer round trips; several in flight at once pipelines the
// network latency to the remote DB (the real bottleneck). Sending 500 rows one
// batch at a time over the Atlantic is what made the first run take ~20 min.
const BATCH = 2000;
const CONCURRENCY = 12;

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
  const inflight = new Set();

  const runBatch = async (stmts) => {
    for (let attempt = 1; ; attempt++) {
      try {
        await client.batch(stmts, "write");
        total += stmts.length;
        process.stdout.write(`\r${total.toLocaleString()} rows loaded…`);
        return;
      } catch (err) {
        if (attempt >= 4) throw err;
        await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
  };

  const dispatch = async (stmts) => {
    const p = runBatch(stmts).finally(() => inflight.delete(p));
    inflight.add(p);
    // Keep at most CONCURRENCY batches in flight; the extra ones pipeline the
    // network round trip while the DB commits the previous ones.
    if (inflight.size >= CONCURRENCY) await Promise.race(inflight);
  };

  let batch = [];
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
      if (batch.length >= BATCH) {
        await dispatch(batch);
        batch = [];
      }
    }
  }
  if (batch.length > 0) await dispatch(batch);
  await Promise.all(inflight);
  console.log(`\n${total.toLocaleString()} listings → Turso table 'listings'.`);
}

main()
  .then(() => client.close())
  .catch((err) => {
    console.error(`\nturso-load failed: ${err.message}`);
    client.close();
    process.exit(1);
  });
