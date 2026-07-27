import { isValidTld } from "./tlds";

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
 * ccTLDs whose registries do not sell names at the second level — you
 * register under a public suffix instead (bluegrid.za is impossible to buy;
 * bluegrid.co.za is the real product). DNS answers NXDOMAIN for the bare
 * form, which would otherwise read as "available". Curated, not exhaustive.
 */
export const SECOND_LEVEL_CLOSED: ReadonlySet<string> = new Set([
  "za",
  "th",
  "np",
  "pg",
  "kh",
  "bn",
  "mm",
  "bd",
  "ck",
]);

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
  // The extension must be a real, IANA-listed TLD — otherwise a bogus one
  // (e.g. "enzo.dsahdsa") sails through DNS as NXDOMAIN and looks available.
  const tld = labels[labels.length - 1];
  if (!isValidTld(tld)) return false;
  // A two-label name under a closed-second-level registry can't be bought,
  // so it must never be checked (NXDOMAIN would fake an "available").
  if (labels.length === 2 && SECOND_LEVEL_CLOSED.has(tld)) return false;
  return true;
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

  // Expand a bare name over the chosen extensions ("enzo" → "enzo.com", …).
  const expand = (name: string) => {
    for (const tld of expandTlds) {
      if (out.size >= MAX_DOMAINS) return;
      const candidate = `${name}.${tld}`;
      if (isValidDomain(candidate)) out.add(candidate);
    }
  };

  for (const token of input.split(/[\s,;"']+/)) {
    if (out.size >= MAX_DOMAINS) break;
    const norm = normalizeToken(token);
    if (!norm) continue;

    const dot = norm.lastIndexOf(".");
    if (dot === -1) {
      // Bare keyword.
      expand(norm);
    } else if (isValidTld(norm.slice(dot + 1))) {
      // Real extension — keep the domain as typed.
      if (isValidDomain(norm)) {
        out.add(norm);
      } else if (
        norm.indexOf(".") === dot &&
        SECOND_LEVEL_CLOSED.has(norm.slice(dot + 1))
      ) {
        // name.za: real TLD but unbuyable at the second level — treat the
        // part before the dot as a bare keyword, like a bogus extension.
        expand(norm.slice(0, dot));
      }
    } else {
      // Bogus extension (e.g. "enzo.dsahdsa"): treat the part before it as a
      // bare name and expand it, so it never gets checked as a real domain.
      const base = norm.slice(0, dot);
      if (base) expand(base);
    }
  }
  return [...out];
}
