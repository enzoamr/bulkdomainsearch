"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { MAX_DOMAINS, parseInput } from "@/lib/domains";
import { buyUrl, REGISTRARS, whoisUrl } from "@/lib/registrars";
import type { CheckResult, DomainStatus } from "@/lib/types";

const VISIBLE_LIMIT = 400;
const CHIP_CAP = 100;
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

const STATUS_META: Record<
  DomainStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  available: { label: "Available", dotClass: "bg-good", textClass: "text-good-text" },
  taken: { label: "Taken", dotClass: "bg-bad", textClass: "text-bad-text" },
  unknown: { label: "Unknown", dotClass: "bg-warn", textClass: "text-warn-text" },
};

export default function BulkSearch() {
  const [domains, setDomains] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [results, setResults] = useState<Map<string, CheckResult>>(new Map());
  const [checking, setChecking] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const domainsRef = useRef<string[]>([]);
  const controllersRef = useRef<Set<AbortController>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const checkNew = useCallback(async (list: string[]) => {
    if (list.length === 0) return;
    const controller = new AbortController();
    controllersRef.current.add(controller);
    setChecking((prev) => new Set([...prev, ...list]));
    const started = performance.now();

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domains: list }),
        signal: controller.signal,
      });
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
      setChecking((prev) => {
        const next = new Set(prev);
        for (const d of list) next.delete(d);
        return next;
      });
    }
  }, []);

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

  const clearAll = useCallback(() => {
    for (const c of controllersRef.current) c.abort();
    controllersRef.current.clear();
    domainsRef.current = [];
    setDomains([]);
    setResults(new Map());
    setChecking(new Set());
    setDraft("");
  }, []);

  const stopChecking = useCallback(() => {
    for (const c of controllersRef.current) c.abort();
    controllersRef.current.clear();
    setChecking(new Set());
  }, []);

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

  const verify = useCallback(async (domain: string) => {
    setVerifying((prev) => new Set(prev).add(domain));
    track("verify_clicked", { domain });
    try {
      const res = await fetch(`/api/verify?domain=${encodeURIComponent(domain)}`);
      if (res.ok) {
        const confirmed = (await res.json()) as CheckResult;
        setResults((prev) => {
          const next = new Map(prev);
          next.set(domain, confirmed);
          return next;
        });
      }
    } finally {
      setVerifying((prev) => {
        const next = new Set(prev);
        next.delete(domain);
        return next;
      });
    }
  }, []);

  const counts = useMemo(() => {
    const c = { available: 0, taken: 0, unknown: 0 };
    for (const r of results.values()) c[r.status]++;
    return c;
  }, [results]);

  const unchecked = useMemo(
    () => domains.filter((d) => !results.has(d) && !checking.has(d)),
    [domains, results, checking],
  );

  const visible = useMemo(() => {
    let list = [...results.values()];
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => r.domain.includes(q));
    }
    if (sortBy === "az") list.sort((a, b) => a.domain.localeCompare(b.domain));
    if (sortBy === "len") list.sort((a, b) => a.domain.length - b.domain.length);
    return list;
  }, [results, filter, query, sortBy]);

  const shown = showAll ? visible : visible.slice(0, VISIBLE_LIMIT);
  const overflow = Math.max(0, domains.length - CHIP_CAP);
  const chipDomains = overflow > 0 ? domains.slice(-CHIP_CAP) : domains;

  const exportCsv = useCallback(() => {
    const rows = [
      "domain,status,source",
      ...visible.map((r) => `${r.domain},${r.status},${r.source}`),
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

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Chip input card */}
      <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-hidden">
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
                commitDraft("enter");
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
                ? "Type or paste domains — press Enter to check…"
                : "Add more…"
            }
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            className="h-8 min-w-48 flex-1 bg-transparent font-mono text-sm text-ink outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
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
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3"
          >
            Import CSV
          </button>
          <button
            onClick={() => addDomains(parseInput(EXAMPLE_INPUT, DEFAULT_TLDS), "example")}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3"
          >
            Example
          </button>
          {domains.length > 0 && (
            <button
              onClick={clearAll}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-3 hover:text-ink-2"
            >
              Clear
            </button>
          )}
          <div className="flex-1" />
          <span className="text-xs tabular-nums text-ink-3">
            {domains.length.toLocaleString()} / {MAX_DOMAINS.toLocaleString()}
          </span>
          {checking.size > 0 && (
            <button
              onClick={stopChecking}
              className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink-2 hover:border-ink-3"
            >
              Stop
            </button>
          )}
          {unchecked.length > 0 && (
            <button
              onClick={() => checkNew(unchecked)}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white"
            >
              Check {unchecked.length.toLocaleString()}
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {checking.size > 0 && (
        <div className="mt-4">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{
                width: `${domains.length > 0 ? (results.size / domains.length) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="mt-1.5 text-xs tabular-nums text-ink-3">
            {results.size.toLocaleString()} / {domains.length.toLocaleString()} checked
          </div>
        </div>
      )}

      {/* Stat tiles */}
      {results.size > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Total"
            value={results.size}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatTile
            label="Available"
            value={counts.available}
            dotClass="bg-good"
            active={filter === "available"}
            onClick={() => setFilter("available")}
          />
          <StatTile
            label="Taken"
            value={counts.taken}
            dotClass="bg-bad"
            active={filter === "taken"}
            onClick={() => setFilter("taken")}
          />
          <StatTile
            label="Unknown"
            value={counts.unknown}
            dotClass="bg-warn"
            active={filter === "unknown"}
            onClick={() => setFilter("unknown")}
          />
        </div>
      )}

      {/* Toolbar + results */}
      {results.size > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter results…"
              className="w-44 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink-2 focus:outline-none"
            >
              <option value="order">Sort: as checked</option>
              <option value="az">Sort: A → Z</option>
              <option value="len">Sort: shortest first</option>
            </select>
            <div className="flex-1" />
            <button
              onClick={copyAvailable}
              disabled={counts.available === 0}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3 disabled:opacity-40"
            >
              {copied ? "Copied ✓" : "Copy available"}
            </button>
            <button
              onClick={exportCsv}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3"
            >
              Export CSV
            </button>
          </div>

          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {shown.map((r) => (
              <ResultRow
                key={r.domain}
                result={r}
                verifying={verifying.has(r.domain)}
                onVerify={() => verify(r.domain)}
              />
            ))}
            {visible.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-ink-3">
                Nothing matches this filter.
              </li>
            )}
          </ul>
          {!showAll && visible.length > VISIBLE_LIMIT && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 w-full rounded-lg border border-line py-2 text-sm text-ink-2 hover:border-ink-3"
            >
              Show all {visible.length.toLocaleString()} results
            </button>
          )}
        </>
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
  const chipClass =
    status === "available"
      ? "bg-good text-white"
      : status === "taken"
        ? "bg-bad text-white"
        : status === "unknown"
          ? "bg-warn text-[#3a2a00]"
          : "border border-line bg-transparent text-ink-2 animate-pulse";
  const href =
    status === "available"
      ? buyUrl(REGISTRARS[0], domain)
      : status === "taken"
        ? whoisUrl(domain)
        : undefined;

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
          title={
            status === "available"
              ? `Register ${domain} at ${REGISTRARS[0].name}`
              : `WHOIS for ${domain}`
          }
          onClick={() =>
            track("registrar_click", { domain, status, placement: "chip" })
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

function StatTile({
  label,
  value,
  dotClass,
  active,
  onClick,
}: {
  label: string;
  value: number;
  dotClass?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border bg-surface p-3.5 text-left transition-colors ${
        active ? "border-accent" : "border-line hover:border-ink-3"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-2">
        {dotClass && <span className={`h-2 w-2 rounded-full ${dotClass}`} />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-ink">
        {value.toLocaleString()}
      </div>
    </button>
  );
}

function ResultRow({
  result,
  verifying,
  onVerify,
}: {
  result: CheckResult;
  verifying: boolean;
  onVerify: () => void;
}) {
  const meta = STATUS_META[result.status];
  const isAvailable = result.status === "available";
  const isConfirmed = result.source === "rdap";

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
      <span className={`flex w-24 shrink-0 items-center gap-1.5 text-xs font-medium ${meta.textClass}`}>
        <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dotClass}`} />
        {meta.label}
      </span>

      {isAvailable ? (
        <a
          href={buyUrl(REGISTRARS[0], result.domain)}
          target="_blank"
          rel="noopener noreferrer sponsored"
          title={`Register ${result.domain} at ${REGISTRARS[0].name}`}
          onClick={() =>
            track("registrar_click", {
              domain: result.domain,
              status: result.status,
              registrar: REGISTRARS[0].id,
              placement: "row",
            })
          }
          className="min-w-0 flex-1 break-all font-mono text-sm text-ink hover:text-accent hover:underline"
        >
          {result.domain}
        </a>
      ) : (
        <span className="min-w-0 flex-1 break-all font-mono text-sm text-ink">
          {result.domain}
        </span>
      )}

      <span
        className="shrink-0 rounded border border-line px-1 py-px text-[10px] uppercase text-ink-3"
        title={
          result.source === "zone"
            ? "Answered from the local zone-file index"
            : result.source === "rdap"
              ? "Confirmed against the registry via RDAP"
              : "Answered via DNS"
        }
      >
        {isConfirmed ? "rdap ✓" : result.source}
      </span>
      <span className="hidden w-14 shrink-0 text-right text-xs tabular-nums text-ink-3 sm:block">
        {result.ms}ms
      </span>

      {isAvailable && (
        <span className="hidden shrink-0 items-center gap-2 md:flex">
          {REGISTRARS.map((reg) => (
            <a
              key={reg.id}
              href={buyUrl(reg, result.domain)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              onClick={() =>
                track("registrar_click", {
                  domain: result.domain,
                  status: result.status,
                  registrar: reg.id,
                  placement: "row",
                })
              }
              className="text-xs text-accent hover:underline"
            >
              {reg.name}
            </a>
          ))}
        </span>
      )}

      {!isConfirmed && result.status !== "taken" && (
        <button
          onClick={onVerify}
          disabled={verifying}
          title="Confirm against the registry via RDAP"
          className="shrink-0 rounded border border-line px-2 py-0.5 text-xs text-ink-2 hover:border-ink-3 disabled:opacity-50"
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
      )}
    </li>
  );
}
