import { sedoOfferUrl } from "./registrars";
import type { Listing } from "./types";

/**
 * Sedo Basic API — the DomainStatus call, which reports whether specific
 * domains are listed for sale on Sedo and at what price. This is the live
 * complement to the local GoDaddy Auctions index: a registered domain that
 * isn't in a local feed can still be for sale on Sedo.
 *
 * Env-gated: needs SEDO_PARTNER_ID + SEDO_SIGN_KEY, issued after joining the
 * free Sedo Partner Program (the same account gives you the campaign ID used
 * for the affiliate offer links). With no credentials this module is inert
 * and the blue tier simply falls back to the local index.
 *
 * DomainStatus is a bulk call (array of domains) but is used here per-domain,
 * behind a small cache + concurrency cap, to fit the streaming check pipeline.
 * At high volume, batch it in the route instead.
 *
 * NOTE: wired against Sedo's documented schema but unverified without live
 * credentials — validate the field parsing once a real partner key exists.
 */

const PARTNER_ID = process.env.SEDO_PARTNER_ID;
const SIGN_KEY = process.env.SEDO_SIGN_KEY;
// Some Sedo accounts require the account login on DomainStatus too (faultcodes
// E5/E6/E12 if missing); include it when set.
const USERNAME = process.env.SEDO_USERNAME;
const PASSWORD = process.env.SEDO_PASSWORD;
const ENDPOINT =
  process.env.SEDO_API_ENDPOINT || "https://api.sedo.com/api/v1/DomainStatus";
const TIMEOUT_MS = 6000;
const MAX_INFLIGHT = 8;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // listings/prices change slowly.

export function sedoEnabled(): boolean {
  return Boolean(PARTNER_ID && SIGN_KEY);
}

const CURRENCY_BY_CODE: Record<string, string> = { "0": "EUR", "1": "USD", "2": "GBP" };

const cache = new Map<string, { at: number; listing: Listing | null }>();
let inflight = 0;

function pick(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1]?.trim();
}

/** Sedo for-sale listing for a domain, or null if not for sale / on error. */
export async function sedoLookup(domain: string): Promise<Listing | null> {
  if (!sedoEnabled()) return null;

  const cached = cache.get(domain);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.listing;
  if (inflight >= MAX_INFLIGHT) return null;

  inflight++;
  try {
    const params = new URLSearchParams({
      partnerid: PARTNER_ID!,
      signkey: SIGN_KEY!,
      output_method: "xml",
      "domainlist[0]": domain,
    });
    if (USERNAME && PASSWORD) {
      params.set("username", USERNAME);
      params.set("password", PASSWORD);
    }
    const res = await fetch(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const xml = await res.text();
    // Real items carry attributes: <item type="tns:DomainStatusResponse[]">.
    const block = xml.match(/<item\b[^>]*>([\s\S]*?)<\/item>/i)?.[1] ?? xml;
    const forsale = pick(block, "forsale");
    if (!forsale || forsale === "0" || forsale.toLowerCase() === "false") {
      cache.set(domain, { at: Date.now(), listing: null });
      return null;
    }

    const priceRaw = pick(block, "price");
    const price = priceRaw ? Number(priceRaw) : NaN;
    // The XML response returns the currency as an ISO string ("EUR"/"USD"/
    // "GBP"); older/code paths use the 0/1/2 request codes. Handle both.
    const rawCurrency = pick(block, "currency");
    const currency = rawCurrency
      ? (CURRENCY_BY_CODE[rawCurrency] ?? rawCurrency.toUpperCase())
      : "USD";
    const listing: Listing = {
      market: "sedo",
      price: Number.isFinite(price) && price > 0 ? price : null,
      currency,
      type: Number.isFinite(price) && price > 0 ? "buyNow" : "makeOffer",
      url: sedoOfferUrl(domain),
    };
    cache.set(domain, { at: Date.now(), listing });
    return listing;
  } catch {
    return null;
  } finally {
    inflight--;
  }
}
