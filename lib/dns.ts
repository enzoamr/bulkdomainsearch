import { Resolver } from "node:dns/promises";

import { splitRegistrable } from "./domains";
import { zoneLookup } from "./zone-index";
import type { CheckResult, DomainStatus } from "./types";

/**
 * Availability check, fastest tier first — the approach from Instant Domain
 * Search's "How we make it fast":
 *
 *   1. zone-file index in memory (no network at all)
 *   2. raw DNS NS query (a few ms; WHOIS would take hundreds)
 *   3. DNS-over-HTTPS fallback for hosts where UDP DNS is blocked
 *
 * An NXDOMAIN answer means no delegation exists → almost certainly
 * available. Any NS answer means the name is delegated → taken.
 */

const NATIVE_TIMEOUT_MS = 1500;
const DOH_TIMEOUT_MS = 4000;
const RESOLVER_IPS = ["1.1.1.1", "8.8.8.8", "9.9.9.9"];

const DOH_ENDPOINTS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
];

// Circuit breaker: after enough consecutive native UDP failures (blocked
// UDP, or public-resolver rate limiting under burst load), stop paying the
// timeout and go straight to DoH. Half-open after a cooldown so a temporary
// rate limit doesn't disable the fast path forever.
let nativeFailureStreak = 0;
let breakerOpenedAt = 0;
const NATIVE_BREAKER_LIMIT = 8;
const BREAKER_COOLDOWN_MS = 20_000;

let resolverRotation = 0;

// Public resolvers rate-limit bursts from a single IP; cap the UDP queries
// in flight and send the overflow straight to DoH instead of queuing into
// timeouts. (Run your own resolver and raise this for serious volume.)
let nativeInflight = 0;
const NATIVE_MAX_INFLIGHT = 16;

async function checkNative(domain: string): Promise<DomainStatus | null> {
  if (nativeInflight >= NATIVE_MAX_INFLIGHT) return null;
  if (nativeFailureStreak >= NATIVE_BREAKER_LIMIT) {
    if (Date.now() - breakerOpenedAt < BREAKER_COOLDOWN_MS) return null;
    // Half-open: let this query probe the native path again.
    nativeFailureStreak = NATIVE_BREAKER_LIMIT - 1;
  }
  const resolver = new Resolver({ timeout: NATIVE_TIMEOUT_MS, tries: 1 });
  resolver.setServers([RESOLVER_IPS[resolverRotation++ % RESOLVER_IPS.length]]);
  nativeInflight++;
  try {
    await resolver.resolveNs(domain);
    nativeFailureStreak = 0;
    return "taken";
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND") {
      nativeFailureStreak = 0;
      return "available";
    }
    if (code === "ENODATA") {
      // The name exists in DNS but has no NS records at this node.
      nativeFailureStreak = 0;
      return "taken";
    }
    nativeFailureStreak++;
    if (nativeFailureStreak === NATIVE_BREAKER_LIMIT) breakerOpenedAt = Date.now();
    return null;
  } finally {
    nativeInflight--;
  }
}

interface DohAnswer {
  Status: number;
}

async function dohQuery(
  base: string,
  domain: string,
  checkingDisabled: boolean,
): Promise<number | null> {
  try {
    const cd = checkingDisabled ? "&cd=1" : "";
    const res = await fetch(
      `${base}?name=${encodeURIComponent(domain)}&type=NS${cd}`,
      {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(DOH_TIMEOUT_MS),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    return ((await res.json()) as DohAnswer).Status;
  } catch {
    return null;
  }
}

async function checkDoh(domain: string): Promise<DomainStatus | null> {
  for (const base of DOH_ENDPOINTS) {
    let status = await dohQuery(base, domain, false);
    if (status === 2) {
      // SERVFAIL is usually a registered domain with broken DNSSEC; ask
      // again with validation disabled to get the real delegation answer.
      status = await dohQuery(base, domain, true);
      if (status === 2) {
        // Still SERVFAIL without validation: a lame delegation. The TLD
        // zone delegates the name (an unregistered name would NXDOMAIN),
        // so the domain is registered even though its nameservers are dead.
        return "taken";
      }
    }
    if (status === 3) return "available"; // NXDOMAIN
    if (status === 0) return "taken"; // NOERROR
    // Anything else: try the next endpoint.
  }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function checkDomain(domain: string): Promise<CheckResult> {
  const started = Date.now();
  const { sld, tld } = splitRegistrable(domain);

  const zoneVerdict = await zoneLookup(sld, tld);
  if (zoneVerdict) {
    return { domain, status: zoneVerdict, source: "zone", ms: Date.now() - started };
  }

  // Up to two passes over native DNS then DoH; the second pass backs off
  // briefly first, which is usually enough to clear a resolver rate limit.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(250 + Math.floor(Math.random() * 250));

    const nativeVerdict = await checkNative(domain);
    if (nativeVerdict) {
      return { domain, status: nativeVerdict, source: "dns", ms: Date.now() - started };
    }

    const dohVerdict = await checkDoh(domain);
    if (dohVerdict) {
      return { domain, status: dohVerdict, source: "doh", ms: Date.now() - started };
    }
  }

  return { domain, status: "unknown", source: "dns", ms: Date.now() - started };
}
