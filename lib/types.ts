export type DomainStatus = "available" | "taken" | "forsale";

/** Where the availability answer came from, fastest to slowest tier. */
export type CheckSource = "zone" | "dns" | "doh" | "rdap";

export type ListingType = "auction" | "buyNow" | "closeout" | "makeOffer";

/** An aftermarket / for-sale listing attached to a registered domain. */
export interface Listing {
  /** Marketplace key, e.g. "godaddy-auctions" or "sedo". */
  market: string;
  /** Price in the currency's major units (dollars, not cents); null = make-offer. */
  price: number | null;
  currency: string;
  type: ListingType;
  /** Affiliate / deep link to the listing. */
  url: string;
  /** Auction end time (ISO), when applicable. */
  endsAt?: string;
  /** Marketplace's own appraisal, when provided (GoDaddy valuation). */
  valuation?: number | null;
}

export interface CheckResult {
  domain: string;
  status: DomainStatus;
  source: CheckSource;
  /** Wall time for this single check, in milliseconds. */
  ms: number;
  /** Present when status is "forsale". */
  listing?: Listing;
}

export interface CheckSummary {
  done: true;
  total: number;
  ms: number;
}
