import { checkDomain } from "@/lib/dns";
import { isValidDomain, MAX_DOMAINS } from "@/lib/domains";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import type { CheckSummary } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A full 5,000-domain batch can run for minutes; without this Vercel cuts
// the stream at its 10s default. 300s is the Hobby-plan ceiling.
export const maxDuration = 300;

/**
 * Streams one NDJSON line per domain as each check completes, so the client
 * renders results the moment they exist instead of waiting for the batch —
 * many results over a single HTTP/2 connection, exactly the "JSON streaming
 * to minimize HTTPS connections" idea. A worker pool keeps CONCURRENCY
 * checks in flight at all times.
 */

const CONCURRENCY = 48;

export async function POST(req: Request) {
  const limit = rateLimit(clientIp(req));
  if (!limit.ok) {
    return Response.json(
      { error: "rate limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { domains?: unknown } | null;
  const raw = Array.isArray(body?.domains) ? body.domains : null;
  if (!raw) {
    return Response.json({ error: "expected { domains: string[] }" }, { status: 400 });
  }

  const domains = [
    ...new Set(
      raw
        .filter((d): d is string => typeof d === "string")
        .map((d) => d.trim().toLowerCase())
        .filter(isValidDomain),
    ),
  ].slice(0, MAX_DOMAINS);

  if (domains.length === 0) {
    return Response.json({ error: "no valid domains" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const started = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let next = 0;

      const worker = async () => {
        while (!req.signal.aborted) {
          const index = next++;
          if (index >= domains.length) return;
          const result = await checkDomain(domains[index]);
          if (req.signal.aborted) return;
          controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
        }
      };

      try {
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, domains.length) }, worker),
        );
        if (!req.signal.aborted) {
          const summary: CheckSummary = {
            done: true,
            total: domains.length,
            ms: Date.now() - started,
          };
          controller.enqueue(encoder.encode(JSON.stringify(summary) + "\n"));
        }
        controller.close();
      } catch {
        // Client disconnected mid-stream; nothing to clean up.
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
