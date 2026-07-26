import { createClient, type Client } from "@libsql/client";

import { aftermarketLookup as localFileLookup } from "./aftermarket-index";
import type { Listing } from "./types";

/**
 * Aftermarket lookup backend. Two modes, chosen at runtime:
 *
 *   - TURSO_DATABASE_URL set → query a hosted SQLite (Turso/libSQL) table over
 *     HTTP. This is what runs on Vercel, where an in-memory index can't
 *     survive across serverless invocations. Reads are an indexed primary-key
 *     SELECT — effectively O(1).
 *   - not set → fall back to the in-memory file index (data/aftermarket/*.ndjson),
 *     which is how local dev and any always-on host work with zero config.
 *
 * The nightly GitHub Action (scripts/turso-load.mjs) rebuilds the table from
 * the GoDaddy Auctions feed, so the Vercel app reads fresh data without ever
 * holding the whole index in memory.
 */

const URL_ = process.env.TURSO_DATABASE_URL;
const AUTH = process.env.TURSO_AUTH_TOKEN;

let client: Client | null | undefined;

function getClient(): Client | null {
  if (client !== undefined) return client;
  client = URL_ ? createClient({ url: URL_, authToken: AUTH }) : null;
  return client;
}

export function aftermarketStoreEnabled(): boolean {
  return Boolean(URL_);
}

export async function lookupListing(domain: string): Promise<Listing | null> {
  const c = getClient();
  if (!c) return localFileLookup(domain);

  try {
    const rs = await c.execute({
      sql: "SELECT data FROM listings WHERE domain = ? LIMIT 1",
      args: [domain.toLowerCase()],
    });
    const row = rs.rows[0];
    if (!row) return null;
    return JSON.parse(String(row.data)) as Listing;
  } catch {
    // A store hiccup must never break availability results.
    return null;
  }
}
