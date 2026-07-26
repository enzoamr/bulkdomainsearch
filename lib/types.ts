export type DomainStatus = "available" | "taken" | "unknown";

/** Where the answer came from, ordered from fastest to slowest tier. */
export type CheckSource = "zone" | "dns" | "doh" | "rdap";

export interface CheckResult {
  domain: string;
  status: DomainStatus;
  source: CheckSource;
  /** Wall time for this single check, in milliseconds. */
  ms: number;
}

export interface CheckSummary {
  done: true;
  total: number;
  ms: number;
}
