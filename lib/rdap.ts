import type { DomainStatus } from "./types";

/**
 * Registry-grade confirmation. Instant Domain Search does a live registry
 * query at the decisive moment; RDAP is the public equivalent — Verisign's
 * own service for .com/.net, and the registry listed in IANA's RDAP
 * bootstrap file for every other TLD that operates one. A 404 from the
 * registry means the name is not registered.
 *
 * rdapCheck returns null when it cannot get a registry verdict (no RDAP
 * service for the TLD, rate limit, outage) — callers keep their DNS-based
 * verdict in that case rather than guessing.
 */

const RDAP_BASES: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1",
  net: "https://rdap.verisign.com/net/v1",
};

// IANA's authoritative map of which TLDs run an RDAP service, and where.
const BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json";
const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;

interface Bootstrap {
  services: [string[], string[]][];
}

let bootstrapMap: Map<string, string> | null = null;
let bootstrapAt = 0;
let bootstrapInflight: Promise<Map<string, string> | null> | null = null;

async function loadBootstrap(): Promise<Map<string, string> | null> {
  if (bootstrapMap && Date.now() - bootstrapAt < BOOTSTRAP_TTL_MS) {
    return bootstrapMap;
  }
  if (!bootstrapInflight) {
    bootstrapInflight = (async () => {
      try {
        const res = await fetch(BOOTSTRAP_URL, {
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return bootstrapMap;
        const data = (await res.json()) as Bootstrap;
        const map = new Map<string, string>();
        for (const [tlds, urls] of data.services) {
          const url = urls.find((u) => u.startsWith("https://")) ?? urls[0];
          if (!url) continue;
          for (const tld of tlds) {
            map.set(tld.toLowerCase(), url.replace(/\/+$/, ""));
          }
        }
        bootstrapMap = map;
        bootstrapAt = Date.now();
        return map;
      } catch {
        return bootstrapMap; // a stale copy beats nothing
      } finally {
        bootstrapInflight = null;
      }
    })();
  }
  return bootstrapInflight;
}

async function rdapBaseFor(tld: string): Promise<string | null> {
  if (RDAP_BASES[tld]) return RDAP_BASES[tld];
  const map = await loadBootstrap();
  return map?.get(tld) ?? null;
}

// Registries rate-limit; cap concurrent RDAP queries so a 5,000-domain batch
// with many availables trickles instead of flooding.
const RDAP_MAX_INFLIGHT = 12;
let rdapInflight = 0;
const rdapWaiters: (() => void)[] = [];

async function acquireRdapSlot(): Promise<void> {
  if (rdapInflight < RDAP_MAX_INFLIGHT) {
    rdapInflight++;
    return;
  }
  await new Promise<void>((resolve) => rdapWaiters.push(resolve));
}

function releaseRdapSlot(): void {
  const next = rdapWaiters.shift();
  if (next) next(); // hand the slot over; inflight count stays the same
  else rdapInflight--;
}

export async function rdapCheck(domain: string): Promise<DomainStatus | null> {
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  const base = await rdapBaseFor(tld);
  if (!base) return null;
  await acquireRdapSlot();
  try {
    const res = await fetch(`${base}/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json" },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
      cache: "no-store",
    });
    if (res.status === 404) return "available";
    if (res.ok) return "taken";
    return null; // 429/5xx: no registry verdict
  } catch {
    return null;
  } finally {
    releaseRdapSlot();
  }
}
