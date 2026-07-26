export const MAX_DOMAINS = 5000;

export const EXPANDABLE_TLDS = [
  "com",
  "net",
  "org",
  "io",
  "co",
  "ai",
  "app",
  "dev",
  "xyz",
  "me",
] as const;

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Normalize a pasted token into a bare name or domain: lowercases, strips
 * scheme/path/query/port, leading "www." and trailing dots. Returns null for
 * tokens that cannot become a domain.
 */
export function normalizeToken(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[/?#]/)[0];
  s = s.split(":")[0];
  s = s.replace(/^www\./, "");
  s = s.replace(/\.+$/, "");
  if (!s || /[^a-z0-9.-]/.test(s)) return null;
  return s;
}

export function isValidDomain(domain: string): boolean {
  if (domain.length < 3 || domain.length > 253) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (!labels.every((l) => LABEL_RE.test(l))) return false;
  // TLD must not be all-numeric.
  return !/^[0-9]+$/.test(labels[labels.length - 1]);
}

/**
 * Registrable pair used for zone-file lookups: last two labels.
 * ("foo.bar.com" → sld "bar", tld "com".)
 */
export function splitRegistrable(domain: string): { sld: string; tld: string } {
  const labels = domain.split(".");
  return {
    sld: labels[labels.length - 2] ?? "",
    tld: labels[labels.length - 1] ?? "",
  };
}

/**
 * Parse free-form bulk input (newlines, commas, semicolons, spaces, CSV
 * columns). Bare keywords are expanded with `expandTlds`; full domains pass
 * through. Deduplicates and caps at MAX_DOMAINS.
 */
export function parseInput(input: string, expandTlds: readonly string[]): string[] {
  const out = new Set<string>();
  for (const token of input.split(/[\s,;"']+/)) {
    if (out.size >= MAX_DOMAINS) break;
    const norm = normalizeToken(token);
    if (!norm) continue;
    if (norm.includes(".")) {
      if (isValidDomain(norm)) out.add(norm);
    } else {
      for (const tld of expandTlds) {
        if (out.size >= MAX_DOMAINS) break;
        const candidate = `${norm}.${tld}`;
        if (isValidDomain(candidate)) out.add(candidate);
      }
    }
  }
  return [...out];
}
