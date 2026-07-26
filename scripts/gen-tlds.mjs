#!/usr/bin/env node
/**
 * Regenerate lib/tlds.ts from IANA's official TLD list.
 * Run: node scripts/gen-tlds.mjs
 */
import fs from "node:fs";

const URL_ = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";
const res = await fetch(URL_);
if (!res.ok) throw new Error(`IANA list: HTTP ${res.status}`);
const text = await res.text();

const lines = text.split("\n");
const header = lines[0].replace(/^#\s*/, "").trim();
const tlds = lines
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.trim().toLowerCase());

const wrapped = [];
for (let i = 0; i < tlds.length; i += 18) {
  wrapped.push("  " + tlds.slice(i, i + 18).join(" "));
}

const out = `/**
 * Valid top-level domains, from IANA's official list.
 * Source: ${URL_}
 * ${header}
 *
 * Used to reject non-existent extensions (e.g. "enzo.dsahdsa") at input time,
 * so they are treated as a bare name (expanded to .com) instead of being
 * checked over DNS, where a bogus TLD returns NXDOMAIN and looks "available".
 * Regenerate with: node scripts/gen-tlds.mjs
 */
const RAW = \`
${wrapped.join("\n")}
\`;

export const VALID_TLDS: ReadonlySet<string> = new Set(
  RAW.split(/\\s+/).filter(Boolean),
);

/** True if \`tld\` (without a leading dot) is a real, IANA-listed TLD. */
export function isValidTld(tld: string): boolean {
  return VALID_TLDS.has(tld.toLowerCase());
}
`;

fs.writeFileSync("lib/tlds.ts", out);
console.log(`wrote lib/tlds.ts with ${tlds.length} TLDs (${out.length} bytes)`);
