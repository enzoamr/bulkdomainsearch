import { checkDomain } from "@/lib/dns";
import { isValidDomain } from "@/lib/domains";
import { rdapCheck } from "@/lib/rdap";
import type { CheckResult } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Registry-grade RDAP confirmation for a single domain (second opinion). */
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain")?.trim().toLowerCase();
  if (!domain || !isValidDomain(domain)) {
    return Response.json({ error: "invalid domain" }, { status: 400 });
  }
  const started = Date.now();
  const status = await rdapCheck(domain);
  // No RDAP service (or no verdict) for this TLD: fall back to a full check
  // rather than fabricating a registry answer.
  const result: CheckResult = status
    ? { domain, status, source: "rdap", ms: Date.now() - started }
    : await checkDomain(domain);
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
