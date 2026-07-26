import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type { Listing } from "./types";

/**
 * In-memory index of aftermarket ("for sale") listings — the blue tier. Same
 * technique as the zone-file index: a marketplace's full inventory is
 * downloaded on a schedule, normalized to one JSON listing per line, and
 * served from memory with an O(1) lookup and zero network round-trip.
 *
 * Files live in data/aftermarket/*.ndjson, one normalized Listing per line
 * with an added `domain` key. GoDaddy Auctions inventory (free, no key) is
 * populated by scripts/godaddy-auctions-download.mjs; other marketplaces can
 * write their own file with the same shape. Empty/missing dir → no blue tier,
 * everything still works.
 */

type IndexedListing = Listing & { domain: string };

interface AftermarketIndex {
  byDomain: Map<string, Listing>;
  loadedAt: number;
}

const g = globalThis as unknown as {
  __aftermarketIndexPromise?: Promise<AftermarketIndex>;
};

// Immediate-purchase listings beat auctions when a domain is listed twice.
const TYPE_RANK: Record<Listing["type"], number> = {
  buyNow: 3,
  closeout: 3,
  auction: 2,
  makeOffer: 1,
};

function preferable(next: Listing, current: Listing): boolean {
  const dr = TYPE_RANK[next.type] - TYPE_RANK[current.type];
  if (dr !== 0) return dr > 0;
  // Same tier: prefer the cheaper concrete price.
  if (next.price != null && current.price != null) return next.price < current.price;
  return next.price != null && current.price == null;
}

async function loadAftermarketIndex(): Promise<AftermarketIndex> {
  const dir = path.join(process.cwd(), "data", "aftermarket");
  const byDomain = new Map<string, Listing>();
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".ndjson")) continue;
      const rl = readline.createInterface({
        input: fs.createReadStream(path.join(dir, file)),
        crlfDelay: Infinity,
      });
      for await (const line of rl) {
        if (!line.trim()) continue;
        let rec: IndexedListing;
        try {
          rec = JSON.parse(line) as IndexedListing;
        } catch {
          continue;
        }
        const { domain, ...listing } = rec;
        if (!domain) continue;
        const key = domain.toLowerCase();
        const existing = byDomain.get(key);
        if (!existing || preferable(listing, existing)) byDomain.set(key, listing);
      }
    }
  }
  return { byDomain, loadedAt: Date.now() };
}

export function getAftermarketIndex(): Promise<AftermarketIndex> {
  g.__aftermarketIndexPromise ??= loadAftermarketIndex();
  return g.__aftermarketIndexPromise;
}

/** Local aftermarket listing for a domain, or null if it isn't indexed. */
export async function aftermarketLookup(domain: string): Promise<Listing | null> {
  const index = await getAftermarketIndex();
  return index.byDomain.get(domain.toLowerCase()) ?? null;
}
