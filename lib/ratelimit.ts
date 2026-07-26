/**
 * Minimal in-memory sliding-window rate limiter, keyed by client IP.
 *
 * This guards our own /api/check from a scraper draining the DNS/registrar
 * quotas we pay for — a client-side signature (what Instant Domain Search
 * ships) proves nothing, because the algorithm and seed travel in the public
 * bundle; real protection is server-side rate limiting.
 *
 * Caveat: state lives in one process, so on serverless/multi-instance this
 * limits per instance, not globally. For a hard global limit put Upstash
 * Redis or a WAF/edge rate rule in front; this is the honest floor.
 */

interface Window {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 10_000;
const MAX_REQUESTS = 8;

const windows = new Map<string, Window>();
let lastSweep = 0;

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  now: number = Date.now(),
): RateLimitResult {
  // Opportunistic cleanup so the map can't grow without bound.
  if (now - lastSweep > WINDOW_MS) {
    for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
    lastSweep = now;
  }

  const win = windows.get(key);
  if (!win || win.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, retryAfterSec: 0 };
  }
  if (win.count >= MAX_REQUESTS) {
    return { ok: false, retryAfterSec: Math.ceil((win.resetAt - now) / 1000) };
  }
  win.count++;
  return { ok: true, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (Vercel/Cloudflare set these). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
