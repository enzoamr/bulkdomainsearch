"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Logo from "@/components/Logo";
import { track } from "@/lib/analytics";
import { MAX_DOMAINS, parseInput } from "@/lib/domains";
import { buyUrl, REGISTRARS, whoisUrl } from "@/lib/registrars";
import type { CheckResult, DomainStatus, Listing } from "@/lib/types";

const MARKET_NAMES: Record<string, string> = {
  "godaddy-auctions": "GoDaddy Auctions",
  sedo: "Sedo",
  afternic: "Afternic",
  atom: "Atom",
};

const LISTING_TYPE_LABEL: Record<Listing["type"], string> = {
  auction: "Auction",
  buyNow: "Buy now",
  closeout: "Closeout",
  makeOffer: "Make offer",
};

function formatPrice(listing: Listing): string {
  if (listing.price == null) return "Make offer";
  const symbol = listing.currency === "USD" ? "$" : listing.currency === "EUR" ? "€" : "";
  const amount = listing.price.toLocaleString();
  return symbol ? `${symbol}${amount}` : `${amount} ${listing.currency}`;
}

/**
 * Map a 0–100 slider position onto the [extent.lo, extent.hi] price range on
 * a log scale, so cheap closeouts and seven-figure listings are both easy to
 * land on. Values are rounded to two significant digits.
 */
function sliderToPrice(
  t: number,
  extent: { lo: number; hi: number },
): number {
  if (t <= 0 || extent.hi <= extent.lo) return extent.lo;
  if (t >= 100) return extent.hi;
  const lo = Math.max(1, extent.lo);
  const raw = Math.exp(
    Math.log(lo) + (t / 100) * (Math.log(extent.hi) - Math.log(lo)),
  );
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / mag) * mag;
}

function fmtCompactPrice(v: number): string {
  const trim = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
  if (v >= 1_000_000) return `${trim(v / 1_000_000)}M`;
  if (v >= 1_000) return `${trim(v / 1_000)}K`;
  return String(v);
}

// Overlaid native range inputs: the track is drawn separately, each input only
// contributes a grabbable thumb.
const RANGE_THUMB_CLASS =
  "pointer-events-none absolute inset-0 h-4 w-full appearance-none bg-transparent " +
  "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_var(--surface)] " +
  "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-ink";

const VISIBLE_LIMIT = 400;
const CHIP_CAP = 20;
// Bare names get this TLD silently — people who want another extension type it.
const DEFAULT_TLDS = ["com"] as const;

const EXAMPLE_INPUT = [
  "solarpunkstudio",
  "quietharbor",
  "maplefox",
  "driftwoodlabs",
  "lucidorbit",
  "papertrailhq",
  "novaanchor",
  "greenloop.dev",
  "instantcheck.io",
  "openvault.app",
].join("\n");

type SortBy = "order" | "az" | "len";
type Filter = "all" | DomainStatus;

export default function BulkSearch() {
  const [domains, setDomains] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<Map<string, CheckResult>>(new Map());
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"compose" | "results">("compose");
  const [tldFilter, setTldFilter] = useState<Set<string>>(new Set());
  // Slider positions 0–100 on a log scale between PRICE_MIN and PRICE_MAX;
  // [0, 100] means "no price filter".
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 100]);
  const [openPanel, setOpenPanel] = useState<"tlds" | "price" | null>(null);

  const domainsRef = useRef<string[]>([]);
  const controllersRef = useRef<Set<AbortController>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  // Coalescing queue: rapid typing commits one chip at a time, and a request
  // per chip trips the per-IP rate limit. Chips added within the window ride
  // in one batched request instead.
  const queueRef = useRef<string[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by Stop/Clear so scheduled retries from before are dropped.
  const genRef = useRef(0);

  const runCheck = useCallback(async (list: string[], attempt = 0) => {
    const gen = genRef.current;
    const controller = new AbortController();
    controllersRef.current.add(controller);
    const started = performance.now();
    let retryScheduled = false;

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domains: list }),
        signal: controller.signal,
      });

      // Rate limited: keep the batch, honor retry-after, resend. The domains
      // stay in "checking" so the UI keeps pulsing instead of dropping them.
      if (res.status === 429 && attempt < 4) {
        const sec = parseInt(res.headers.get("retry-after") ?? "", 10);
        const delay = (Number.isFinite(sec) && sec > 0 ? sec : 2) * 1000;
        retryScheduled = true;
        setTimeout(
          () => {
            if (gen === genRef.current) runCheck(list, attempt + 1);
          },
          delay + Math.floor(Math.random() * 400),
        );
        return;
      }

      if (!res.ok || !res.body) throw new Error(`check failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        const batch: CheckResult[] = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const obj = JSON.parse(line) as CheckResult | { done: true };
          if ("done" in obj && obj.done === true) continue;
          batch.push(obj as CheckResult);
        }
        if (batch.length > 0) {
          const current = new Set(domainsRef.current);
          setResults((prev) => {
            const next = new Map(prev);
            for (const r of batch) {
              if (current.has(r.domain)) next.set(r.domain, r);
            }
            return next;
          });
          setChecking((prev) => {
            const next = new Set(prev);
            for (const r of batch) next.delete(r.domain);
            return next;
          });
        }
      }
      track("check_completed", {
        count: list.length,
        duration_ms: Math.round(performance.now() - started),
      });
    } catch {
      // Aborted or network failure; leftover "checking" state clears below.
    } finally {
      controllersRef.current.delete(controller);
      if (!retryScheduled) {
        setChecking((prev) => {
          const next = new Set(prev);
          for (const d of list) next.delete(d);
          return next;
        });
      }
    }
  }, []);

  const checkNew = useCallback(
    (list: string[]) => {
      if (list.length === 0) return;
      setChecking((prev) => new Set([...prev, ...list]));
      queueRef.current.push(...list);
      if (flushTimerRef.current != null) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        const batch = [...new Set(queueRef.current)];
        queueRef.current = [];
        if (batch.length > 0) runCheck(batch);
      }, 300);
    },
    [runCheck],
  );

  const addDomains = useCallback(
    (list: string[], method: string) => {
      const existing = new Set(domainsRef.current);
      const fresh: string[] = [];
      for (const d of list) {
        if (existing.size + fresh.length >= MAX_DOMAINS) break;
        if (!existing.has(d)) {
          existing.add(d);
          fresh.push(d);
        }
      }
      if (fresh.length === 0) return;
      domainsRef.current = [...domainsRef.current, ...fresh];
      setDomains(domainsRef.current);
      track("domains_added", {
        count: fresh.length,
        method,
        total: domainsRef.current.length,
      });
      checkNew(fresh);
    },
    [checkNew],
  );

  const removeDomain = useCallback((domain: string) => {
    domainsRef.current = domainsRef.current.filter((d) => d !== domain);
    setDomains(domainsRef.current);
    setResults((prev) => {
      const next = new Map(prev);
      next.delete(domain);
      return next;
    });
    setChecking((prev) => {
      const next = new Set(prev);
      next.delete(domain);
      return next;
    });
    track("domain_removed", { total: domainsRef.current.length });
  }, []);

  const cancelPending = useCallback(() => {
    genRef.current++;
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    queueRef.current = [];
    for (const c of controllersRef.current) c.abort();
    controllersRef.current.clear();
  }, []);

  const clearAll = useCallback(() => {
    cancelPending();
    domainsRef.current = [];
    setDomains([]);
    setResults(new Map());
    setChecking(new Set());
    setDraft("");
    setFilter("all");
    setQuery("");
    setTldFilter(new Set());
    setPriceRange([0, 100]);
    setOpenPanel(null);
  }, [cancelPending]);

  const stopChecking = useCallback(() => {
    cancelPending();
    setChecking(new Set());
  }, [cancelPending]);

  const commitDraft = useCallback(
    (method: string) => {
      const tokens = parseInput(draft, DEFAULT_TLDS);
      if (tokens.length > 0) addDomains(tokens, method);
      setDraft("");
    },
    [draft, addDomains],
  );

  // Separators (space, comma, semicolon) commit completed tokens as chips
  // while the tail keeps being typed — classic tag-input behavior.
  const handleDraftChange = useCallback(
    (value: string) => {
      if (!/[\s,;]/.test(value)) {
        setDraft(value);
        return;
      }
      const endsWithSeparator = /[\s,;]$/.test(value);
      const parts = value.split(/[\s,;]+/).filter(Boolean);
      const commit = endsWithSeparator ? parts : parts.slice(0, -1);
      const rest = endsWithSeparator ? "" : (parts[parts.length - 1] ?? "");
      if (commit.length > 0) {
        addDomains(parseInput(commit.join("\n"), DEFAULT_TLDS), "type");
      }
      setDraft(rest);
    },
    [addDomains],
  );

  const counts = useMemo(() => {
    const c = { available: 0, forsale: 0, taken: 0 };
    for (const r of results.values()) c[r.status]++;
    return c;
  }, [results]);

  const unchecked = useMemo(
    () => domains.filter((d) => !results.has(d) && !checking.has(d)),
    [domains, results, checking],
  );

  // The arrow button: run any stragglers and switch to the results page.
  const openResults = useCallback(() => {
    if (domainsRef.current.length === 0) return;
    if (unchecked.length > 0) checkNew(unchecked);
    setView("results");
    track("view_results", { count: domainsRef.current.length });
  }, [unchecked, checkNew]);

  // The results view is a full-screen overlay: freeze the page scroll behind
  // it and let Escape close it.
  useEffect(() => {
    if (view !== "results") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setView("compose");
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [view]);

  // Extensions present in the current search, most frequent first — feeds the
  // TLDs filter panel in the results sidebar.
  const tldCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of domains) {
      const tld = d.slice(d.lastIndexOf(".") + 1);
      m.set(tld, (m.get(tld) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [domains]);

  // Lowest and highest listing price present in the current results — the
  // slider's endpoints track what's actually there.
  const priceExtent = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const r of results.values()) {
      const p = r.listing?.price;
      if (p != null) {
        if (p < lo) lo = p;
        if (p > hi) hi = p;
      }
    }
    return lo === Infinity ? null : { lo, hi };
  }, [results]);

  const priceBounds = useMemo(() => {
    if (!priceExtent) return { min: null, max: null };
    const [lo, hi] = priceRange;
    return {
      min: lo <= 0 ? null : sliderToPrice(lo, priceExtent),
      max: hi >= 100 ? null : sliderToPrice(hi, priceExtent),
    };
  }, [priceRange, priceExtent]);

  const visible = useMemo(() => {
    let list = [...results.values()];
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => r.domain.includes(q));
    }
    if (tldFilter.size > 0) {
      list = list.filter((r) =>
        tldFilter.has(r.domain.slice(r.domain.lastIndexOf(".") + 1)),
      );
    }
    if (priceBounds.min != null || priceBounds.max != null) {
      // A price range only makes sense for priced aftermarket listings.
      list = list.filter(
        (r) =>
          r.listing?.price != null &&
          (priceBounds.min == null || r.listing.price >= priceBounds.min) &&
          (priceBounds.max == null || r.listing.price <= priceBounds.max),
      );
    }
    if (sortBy === "az") list.sort((a, b) => a.domain.localeCompare(b.domain));
    if (sortBy === "len") list.sort((a, b) => a.domain.length - b.domain.length);
    return list;
  }, [results, filter, query, sortBy, tldFilter, priceBounds]);

  // Domains still awaiting a verdict — rendered as skeleton rows in the grid
  // so the results page fills top-to-bottom as answers stream in (like IDS).
  const pending = useMemo(() => {
    if (filter !== "all") return [];
    // A pending domain has no listing yet, so it can't match a price range.
    if (priceBounds.min != null || priceBounds.max != null) return [];
    const q = query.trim().toLowerCase();
    return domains.filter((d) => {
      if (results.has(d)) return false;
      if (q && !d.includes(q)) return false;
      if (
        tldFilter.size > 0 &&
        !tldFilter.has(d.slice(d.lastIndexOf(".") + 1))
      ) {
        return false;
      }
      return true;
    });
  }, [domains, results, filter, query, tldFilter, priceBounds]);

  const shown = showAll ? visible : visible.slice(0, VISIBLE_LIMIT);
  const shownPending = showAll
    ? pending
    : pending.slice(0, Math.max(0, VISIBLE_LIMIT - shown.length));
  const overflow = Math.max(0, domains.length - CHIP_CAP);
  const chipDomains = overflow > 0 ? domains.slice(-CHIP_CAP) : domains;

  const exportCsv = useCallback(() => {
    const rows = [
      "domain,status,source,market,price,currency,listing_type,url",
      ...visible.map((r) => {
        const l = r.listing;
        return [
          r.domain,
          r.status,
          r.source,
          l?.market ?? "",
          l?.price ?? "",
          l?.currency ?? "",
          l?.type ?? "",
          l?.url ?? "",
        ].join(",");
      }),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "domains.csv";
    a.click();
    URL.revokeObjectURL(url);
    track("export_csv", { count: visible.length });
  }, [visible]);

  const copyAvailable = useCallback(async () => {
    const names = [...results.values()]
      .filter((r) => r.status === "available")
      .map((r) => r.domain);
    await navigator.clipboard.writeText(names.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    track("copy_available", { count: names.length });
  }, [results]);

  const importFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      addDomains(parseInput(text, DEFAULT_TLDS), "csv");
    },
    [addDomains],
  );

  const hiddenInput = (
    <input
      ref={fileRef}
      type="file"
      accept=".csv,.txt"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) importFile(f);
        e.target.value = "";
      }}
    />
  );

  if (view === "results") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background text-ink">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5 sm:px-5">
          <Logo />
          <button
            onClick={() => setView("compose")}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            New bulk search
          </button>
          <div className="flex-1" />
          {checking.size > 0 && (
            <button
              onClick={stopChecking}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-ink/5"
            >
              Stop
            </button>
          )}
        </div>

        {/* Thin progress line while checks stream in */}
        {checking.size > 0 && (
          <div className="h-0.5 w-full overflow-hidden bg-ink/10">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{
                width: `${domains.length > 0 ? (results.size / domains.length) * 100 : 0}%`,
              }}
            />
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-line px-4 py-5 md:flex">
            <div className="px-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Display
            </div>
            <nav className="mt-2 space-y-1">
              <SideFilter
                label="All domains"
                count={domains.length}
                barClass="bg-ink-3"
                active={filter === "all"}
                onClick={() => setFilter("all")}
              />
              <SideFilter
                label="Available"
                count={counts.available}
                barClass="bg-good"
                active={filter === "available"}
                onClick={() => setFilter("available")}
              />
              <SideFilter
                label="For sale"
                count={counts.forsale}
                barClass="bg-sale"
                active={filter === "forsale"}
                onClick={() => setFilter("forsale")}
              />
              <SideFilter
                label="Taken"
                count={counts.taken}
                barClass="bg-bad"
                active={filter === "taken"}
                onClick={() => setFilter("taken")}
              />
            </nav>

            <div className="mt-5 border-t border-line" />
            <div className="mt-5 px-2 text-xs font-semibold uppercase tracking-wide text-ink-3">
              Filters
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter results…"
              className="mt-2 w-full rounded-lg border border-line bg-transparent px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
            />
            <nav className="mt-2 space-y-0.5">
              <FilterRow
                label="TLDs"
                active={tldFilter.size > 0}
                badge={tldFilter.size > 0 ? tldFilter.size : undefined}
                onClick={() =>
                  setOpenPanel((p) => (p === "tlds" ? null : "tlds"))
                }
                icon={
                  <svg {...FILTER_ICON_PROPS} aria-hidden="true">
                    <path d="M5 3a2 2 0 0 0-2 2" />
                    <path d="M19 3a2 2 0 0 1 2 2" />
                    <path d="M21 19a2 2 0 0 1-2 2" />
                    <path d="M5 21a2 2 0 0 1-2-2" />
                    <path d="M9 3h1" />
                    <path d="M9 21h1" />
                    <path d="M14 3h1" />
                    <path d="M14 21h1" />
                    <path d="M3 9v1" />
                    <path d="M21 9v1" />
                    <path d="M3 14v1" />
                    <path d="M21 14v1" />
                  </svg>
                }
              />
              {openPanel === "tlds" && (
                <div className="ml-9 space-y-0.5 py-1 pr-2">
                  {tldCounts.map(([tld, n]) => (
                    <button
                      key={tld}
                      onClick={() =>
                        setTldFilter((prev) => {
                          const next = new Set(prev);
                          if (next.has(tld)) next.delete(tld);
                          else next.add(tld);
                          return next;
                        })
                      }
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors ${
                        tldFilter.has(tld)
                          ? "bg-ink/10 text-ink"
                          : "text-ink-2 hover:bg-ink/5 hover:text-ink"
                      }`}
                    >
                      <span className="flex-1 font-mono">.{tld}</span>
                      <span className="text-xs tabular-nums text-ink-3">
                        {n.toLocaleString()}
                      </span>
                    </button>
                  ))}
                  {tldFilter.size > 0 && (
                    <button
                      onClick={() => setTldFilter(new Set())}
                      className="w-full rounded-md px-2 py-1 text-left text-xs text-ink-3 hover:text-ink"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}
              <FilterRow
                label="Sort A-Z"
                active={sortBy === "az"}
                onClick={() => setSortBy((s) => (s === "az" ? "order" : "az"))}
                icon={
                  <svg {...FILTER_ICON_PROPS} aria-hidden="true">
                    <path d="m3 16 4 4 4-4" />
                    <path d="M7 20V4" />
                    <path d="M20 8h-5" />
                    <path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10" />
                    <path d="M15 14h5l-5 6h5" />
                  </svg>
                }
              />
              <FilterRow
                label="Sort by length"
                active={sortBy === "len"}
                onClick={() => setSortBy((s) => (s === "len" ? "order" : "len"))}
                icon={
                  <svg {...FILTER_ICON_PROPS} aria-hidden="true">
                    <path d="m3 16 4 4 4-4" />
                    <path d="M7 20V4" />
                    <path d="M11 4h4" />
                    <path d="M11 8h7" />
                    <path d="M11 12h10" />
                  </svg>
                }
              />
              <FilterRow
                label="Price range"
                active={priceBounds.min != null || priceBounds.max != null}
                onClick={() =>
                  setOpenPanel((p) => (p === "price" ? null : "price"))
                }
                icon={
                  <svg {...FILTER_ICON_PROPS} aria-hidden="true">
                    <line x1="21" x2="14" y1="4" y2="4" />
                    <line x1="10" x2="3" y1="4" y2="4" />
                    <line x1="21" x2="12" y1="12" y2="12" />
                    <line x1="8" x2="3" y1="12" y2="12" />
                    <line x1="21" x2="16" y1="20" y2="20" />
                    <line x1="12" x2="3" y1="20" y2="20" />
                    <line x1="14" x2="14" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="10" y2="14" />
                    <line x1="16" x2="16" y1="18" y2="22" />
                  </svg>
                }
              />
              {openPanel === "price" &&
                (priceExtent ? (
                  <div className="mx-1 mt-1 rounded-xl border border-line bg-ink/5 px-3.5 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">
                        Filter by price
                      </span>
                      <button
                        onClick={() => setPriceRange([0, 100])}
                        className="text-xs text-ink-3 hover:text-ink"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="relative mt-4 h-4">
                      <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
                      <div
                        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent"
                        style={{
                          left: `${priceRange[0]}%`,
                          right: `${100 - priceRange[1]}%`,
                        }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={priceRange[0]}
                        aria-label="Minimum price"
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPriceRange(([, hi]) => [Math.min(v, hi), hi]);
                        }}
                        style={{ zIndex: priceRange[0] > 90 ? 30 : 20 }}
                        className={RANGE_THUMB_CLASS}
                      />
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={priceRange[1]}
                        aria-label="Maximum price"
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setPriceRange(([lo]) => [lo, Math.max(v, lo)]);
                        }}
                        style={{ zIndex: 25 }}
                        className={RANGE_THUMB_CLASS}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-ink-2">
                      <span>
                        Min: {fmtCompactPrice(priceBounds.min ?? priceExtent.lo)}
                      </span>
                      <span>
                        Max: {fmtCompactPrice(priceBounds.max ?? priceExtent.hi)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="ml-9 py-1 pr-2 text-xs text-ink-3">
                    No priced listings yet.
                  </div>
                ))}
            </nav>

            <div className="mt-auto pt-6">
              <div className="border-t border-line" />
              <nav className="mt-3 space-y-0.5">
                <FilterRow
                  label={copied ? "Copied" : "Copy available"}
                  active={copied}
                  disabled={counts.available === 0}
                  onClick={copyAvailable}
                  icon={
                    copied ? (
                      <svg {...FILTER_ICON_PROPS} aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      <svg {...FILTER_ICON_PROPS} aria-hidden="true">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    )
                  }
                />
                <FilterRow
                  label="Export results"
                  active={false}
                  onClick={exportCsv}
                  icon={
                    <svg {...FILTER_ICON_PROPS} aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                  }
                />
              </nav>
            </div>
          </aside>

          {/* Results */}
          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-base font-semibold">
                {domains.length.toLocaleString()} domain
                {domains.length === 1 ? "" : "s"} searched
              </h2>
              {checking.size > 0 && (
                <span className="text-xs tabular-nums text-ink-3">
                  {results.size.toLocaleString()} / {domains.length.toLocaleString()} checked
                </span>
              )}
            </div>

            {/* Mobile filter chips — the sidebar is hidden below md */}
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {(
                [
                  { key: "all", label: "All", count: domains.length, dot: "bg-ink-3" },
                  { key: "available", label: "Available", count: counts.available, dot: "bg-good" },
                  { key: "forsale", label: "For sale", count: counts.forsale, dot: "bg-sale" },
                  { key: "taken", label: "Taken", count: counts.taken, dot: "bg-bad" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                    filter === f.key
                      ? "border-accent text-ink"
                      : "border-line text-ink-2"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${f.dot}`} />
                  {f.label} {f.count.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-x-10 lg:grid-cols-2">
              {shown.map((r) => (
                <ResultLine key={r.domain} result={r} />
              ))}
              {shownPending.map((d) => (
                <PendingLine key={d} domain={d} />
              ))}
            </div>

            {visible.length === 0 && pending.length === 0 && (
              <div className="mt-10 text-center text-sm text-ink-3">
                Nothing matches this filter.
              </div>
            )}

            {!showAll &&
              visible.length + pending.length > shown.length + shownPending.length && (
                <button
                  onClick={() => setShowAll(true)}
                  className="mt-5 w-full rounded-lg border border-line py-2 text-sm text-ink-2 hover:bg-ink/5"
                >
                  Show all {(visible.length + pending.length).toLocaleString()} results
                </button>
              )}
          </main>
        </div>

        {hiddenInput}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4">
      {/* Chip input card */}
      <div className="rounded-2xl border-2 border-line bg-surface shadow-sm overflow-hidden transition-colors focus-within:border-accent">
        <div
          className="flex min-h-32 cursor-text flex-wrap content-start items-start gap-2 px-3 py-3"
          onClick={() => inputRef.current?.focus()}
        >
          {overflow > 0 && (
            <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium text-ink-3 md:text-sm">
              +{overflow.toLocaleString()} more…
            </span>
          )}
          {chipDomains.map((domain) => (
            <DomainChip
              key={domain}
              domain={domain}
              result={results.get(domain)}
              onRemove={() => removeDomain(domain)}
            />
          ))}
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                // Enter just commits the typed name as a chip. Only an Enter on
                // an empty field (nothing left to add) opens the results page,
                // the same as pressing the arrow button.
                if (draft.trim()) {
                  commitDraft("enter");
                } else if (domains.length > 0) {
                  openResults();
                }
              } else if (e.key === "Backspace" && draft === "" && domains.length > 0) {
                removeDomain(domains[domains.length - 1]);
              }
            }}
            onBlur={() => commitDraft("blur")}
            onPaste={(e) => {
              e.preventDefault();
              addDomains(
                parseInput(e.clipboardData.getData("text"), DEFAULT_TLDS),
                "paste",
              );
            }}
            placeholder={
              domains.length === 0
                ? "Type or paste domains…"
                : "Add more…"
            }
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            className="h-8 min-w-48 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          {hiddenInput}
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Import CSV
          </button>
          <button
            onClick={() => addDomains(parseInput(EXAMPLE_INPUT, DEFAULT_TLDS), "example")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
            Example
          </button>
          {domains.length > 0 && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-ink-3 hover:text-ink-2"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              Clear
            </button>
          )}
          <div className="flex-1" />
          <span className="text-xs tabular-nums text-ink-3">
            {domains.length.toLocaleString()} / {MAX_DOMAINS.toLocaleString()}
          </span>
          <button
            onClick={openResults}
            disabled={domains.length === 0}
            aria-label="Search all domains"
            title="Search all domains"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Live feedback while checks stream in the background */}
      {results.size > 0 && (
        <button
          onClick={() => setView("results")}
          className="mt-4 flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-ink-3"
        >
          <span className="font-medium text-ink">
            {results.size.toLocaleString()} checked
          </span>
          <span className="inline-flex items-center gap-1.5 text-good-text">
            <span className="h-2 w-2 rounded-full bg-good" />
            {counts.available.toLocaleString()} available
          </span>
          <span className="inline-flex items-center gap-1.5 text-sale-text">
            <span className="h-2 w-2 rounded-full bg-sale" />
            {counts.forsale.toLocaleString()} for sale
          </span>
          <span className="inline-flex items-center gap-1.5 text-bad-text">
            <span className="h-2 w-2 rounded-full bg-bad" />
            {counts.taken.toLocaleString()} taken
          </span>
          <span className="flex-1" />
          <span className="font-medium text-accent">View results</span>
        </button>
      )}
    </div>
  );
}

function DomainChip({
  domain,
  result,
  onRemove,
}: {
  domain: string;
  result: CheckResult | undefined;
  onRemove: () => void;
}) {
  const status = result?.status;
  const listing = result?.listing;
  const chipClass =
    status === "available"
      ? "bg-good text-white"
      : status === "forsale"
        ? "bg-sale text-white"
        : status === "taken"
          ? "bg-bad text-white"
          : "border border-line bg-transparent text-ink-2 animate-pulse";
  const href =
    status === "available"
      ? buyUrl(REGISTRARS[0], domain)
      : status === "forsale"
        ? listing?.url
        : status === "taken"
          ? whoisUrl(domain)
          : undefined;
  const title =
    status === "available"
      ? `Register ${domain} at ${REGISTRARS[0].name}`
      : status === "forsale" && listing
        ? `${formatPrice(listing)} — ${MARKET_NAMES[listing.market] ?? listing.market}`
        : `WHOIS for ${domain}`;

  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-md text-xs font-medium md:text-sm ${chipClass}`}
      onClick={(e) => e.stopPropagation()}
    >
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="sponsored noopener nofollow"
          aria-label={domain}
          title={title}
          onClick={() =>
            track("registrar_click", {
              domain,
              status,
              market: listing?.market,
              placement: "chip",
            })
          }
          className="py-1 pl-2 font-mono hover:opacity-90"
        >
          {domain}
        </a>
      ) : (
        <span className="py-1 pl-2 font-mono">{domain}</span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${domain}`}
        className="flex items-center px-1.5 transition-colors hover:bg-black/25"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </span>
  );
}

const FILTER_ICON_PROPS = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function FilterRow({
  icon,
  label,
  active,
  badge,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-ink/5 disabled:opacity-40 disabled:hover:bg-transparent ${
        active ? "text-ink" : "text-ink-2 hover:text-ink"
      }`}
    >
      <span className={active ? "text-accent" : "text-ink-3"}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge != null && (
        <span className="rounded-full bg-accent/20 px-1.5 text-xs tabular-nums text-accent">
          {badge}
        </span>
      )}
    </button>
  );
}

function SideFilter({
  label,
  count,
  barClass,
  active,
  onClick,
}: {
  label: string;
  count: number;
  barClass: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-ink/10 text-ink"
          : "text-ink-2 hover:bg-ink/5 hover:text-ink"
      }`}
    >
      <span className={`h-4 w-1 shrink-0 rounded-full ${barClass}`} />
      <span className="flex-1">{label}</span>
      <span className="text-xs tabular-nums text-ink-3">
        {count.toLocaleString()}
      </span>
    </button>
  );
}

function PendingLine({ domain }: { domain: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-line py-2.5">
      <span className="h-6 w-1 shrink-0 animate-pulse rounded-full bg-line" />
      <span className="min-w-0 flex-1 truncate font-mono text-sm text-ink-3">
        {domain}
      </span>
      <span className="shrink-0 text-xs text-ink-3">Checking…</span>
    </div>
  );
}

function ResultLine({ result }: { result: CheckResult }) {
  const isAvailable = result.status === "available";
  const listing = result.status === "forsale" ? result.listing : undefined;

  const bar = isAvailable ? "bg-good" : listing ? "bg-sale" : "bg-bad";
  const href = isAvailable
    ? buyUrl(REGISTRARS[0], result.domain)
    : listing
      ? listing.url
      : whoisUrl(result.domain);
  const title = isAvailable
    ? `Register ${result.domain} at ${REGISTRARS[0].name}`
    : listing
      ? `${formatPrice(listing)} · ${LISTING_TYPE_LABEL[listing.type]} at ${MARKET_NAMES[listing.market] ?? listing.market}`
      : `WHOIS for ${result.domain}`;
  const onClickTrack = () =>
    track("registrar_click", {
      domain: result.domain,
      status: result.status,
      registrar: isAvailable ? REGISTRARS[0].id : undefined,
      market: listing?.market,
      placement: "grid",
    });

  return (
    <div className="group flex min-w-0 items-center gap-3 border-b border-line py-2.5">
      <span className={`h-6 w-1 shrink-0 rounded-full ${bar}`} />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        title={title}
        onClick={onClickTrack}
        className="min-w-0 flex-1 truncate font-mono text-sm text-ink hover:underline"
      >
        {result.domain}
      </a>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        title={title}
        onClick={onClickTrack}
        className={`shrink-0 text-sm font-medium hover:underline ${
          isAvailable
            ? "text-good-text"
            : listing
              ? "text-sale-text"
              : "text-bad-text"
        }`}
      >
        {isAvailable ? "Register" : listing ? formatPrice(listing) : "Lookup"}
      </a>
    </div>
  );
}
