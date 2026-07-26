import type { DomainStatus } from "./types";

/**
 * Registry-grade confirmation. Instant Domain Search does a live Verisign
 * query for .com at the decisive moment; RDAP is the public equivalent —
 * Verisign's own RDAP service for .com/.net, the IANA bootstrap via rdap.org
 * for everything else. A 404 from the registry means the name is not
 * registered.
 */

const RDAP_BASES: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1",
  net: "https://rdap.verisign.com/net/v1",
};

export async function rdapCheck(domain: string): Promise<DomainStatus> {
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  const base = RDAP_BASES[tld] ?? "https://rdap.org";
  try {
    const res = await fetch(`${base}/domain/${encodeURIComponent(domain)}`, {
      headers: { accept: "application/rdap+json" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      cache: "no-store",
    });
    // 404 = not registered; anything else (registered, or an error we can't
    // interpret) is treated as taken so we never falsely claim availability.
    return res.status === 404 ? "available" : "taken";
  } catch {
    return "taken";
  }
}
