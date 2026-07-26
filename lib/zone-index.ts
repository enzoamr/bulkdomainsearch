import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import type { DomainStatus } from "./types";

/**
 * In-memory index of registry zone files — the same technique Instant Domain
 * Search describes: download the full list of registered names for each TLD
 * every night, index it locally, and answer availability checks from memory
 * with zero network round-trips.
 *
 * Files live in data/zones/{tld}.txt with one registered second-level name
 * per line (no TLD suffix). Populate them with scripts/czds-download.mjs
 * (ICANN CZDS credentials required). If a TLD has no zone file on disk, the
 * checker falls back to DNS.
 */

interface ZoneIndex {
  tlds: Map<string, Set<string>>;
  loadedAt: number;
}

const g = globalThis as unknown as { __zoneIndexPromise?: Promise<ZoneIndex> };

async function loadZoneIndex(): Promise<ZoneIndex> {
  const dir = path.join(process.cwd(), "data", "zones");
  const tlds = new Map<string, Set<string>>();
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".txt")) continue;
      const tld = file.slice(0, -4).toLowerCase();
      const names = new Set<string>();
      const rl = readline.createInterface({
        input: fs.createReadStream(path.join(dir, file)),
        crlfDelay: Infinity,
      });
      for await (const line of rl) {
        const name = line.trim().toLowerCase();
        if (name) names.add(name);
      }
      if (names.size > 0) tlds.set(tld, names);
    }
  }
  return { tlds, loadedAt: Date.now() };
}

export function getZoneIndex(): Promise<ZoneIndex> {
  g.__zoneIndexPromise ??= loadZoneIndex();
  return g.__zoneIndexPromise;
}

/**
 * Zone-file verdict for a registrable name, or null when we hold no zone
 * data for this TLD (caller should fall back to DNS).
 */
export async function zoneLookup(sld: string, tld: string): Promise<DomainStatus | null> {
  const index = await getZoneIndex();
  const names = index.tlds.get(tld);
  if (!names) return null;
  return names.has(sld) ? "taken" : "available";
}
