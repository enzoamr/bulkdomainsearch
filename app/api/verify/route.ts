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
  const result: CheckResult = {
    domain,
    status,
    source: "rdap",
    ms: Date.now() - started,
  };
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
