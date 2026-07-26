"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EXPANDABLE_TLDS, MAX_DOMAINS, parseInput } from "@/lib/domains";
import { buyUrl, REGISTRARS } from "@/lib/registrars";
import type { CheckResult, DomainStatus } from "@/lib/types";

const AUTO_CHECK_LIMIT = 250;
const VISIBLE_LIMIT = 400;

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

type Phase = "idle" | "checking" | "done";
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
  const [input, setInput] = useState("");
  const [tlds, setTlds] = useState<string[]>(["com"]);
  const [results, setResults] = useState<Map<string, CheckResult>>(new Map());
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, ms: 0 });
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("order");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [verifying, setVerifying] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(() => parseInput(input, tlds), [input, tlds]);

  const runCheck = useCallback(async (domains: string[]) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setResults(new Map());
    setShowAll(false);
    setPhase("checking");
    const started = performance.now();
    setProgress({ done: 0, total: domains.length, ms: 0 });

    let done = 0;
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domains }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`check failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
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
          done += batch.length;
          setResults((prev) => {
            const next = new Map(prev);
            for (const r of batch) next.set(r.domain, r);
            return next;
          });
          setProgress({
            done,
            total: domains.length,
            ms: performance.now() - started,
          });
        }
      }
      setPhase("done");
    } catch {
      if (!controller.signal.aborted) setPhase("done");
    }
  }, []);

  const stopCheck = useCallback(() => {
    abortRef.current?.abort();
    setPhase("done");
  }, []);

  const handleInput = useCallback(
    (value: string) => {
      setInput(value);
      if (parseInput(value, tlds).length === 0) {
        abortRef.current?.abort();
        setResults(new Map());
        setPhase("idle");
        setProgress({ done: 0, total: 0, ms: 0 });
      }
    },
    [tlds],
  );

  // "Without the need to even press a search button": small batches check
  // themselves as you type; big batches wait for an explicit click.
  useEffect(() => {
    if (parsed.length === 0 || parsed.length > AUTO_CHECK_LIMIT) return;
    const timer = setTimeout(() => runCheck(parsed), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, tlds]);

  const verify = useCallback(async (domain: string) => {
    setVerifying((prev) => new Set(prev).add(domain));
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
  const rate =
    progress.ms > 200 ? Math.round((progress.done / progress.ms) * 1000) : 0;

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
  }, [visible]);

  const copyAvailable = useCallback(async () => {
    const names = [...results.values()]
      .filter((r) => r.status === "available")
      .map((r) => r.domain);
    await navigator.clipboard.writeText(names.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [results]);

  const importFile = useCallback(async (file: File) => {
    const text = await file.text();
    setInput((prev) => (prev.trim() ? `${prev}\n${text}` : text));
  }, []);

  const toggleTld = (tld: string) =>
    setTlds((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld],
    );

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Input card */}
      <div className="rounded-2xl border border-line bg-surface shadow-sm overflow-hidden">
        <textarea
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && parsed.length > 0) {
              e.preventDefault();
              runCheck(parsed);
            }
          }}
          placeholder={
            "Paste names or domains — one per line, or comma-separated.\n\nmybrand\ncoolstartup.com\nnextbigthing.io"
          }
          spellCheck={false}
          className="w-full h-44 resize-y bg-transparent px-4 py-3 font-mono text-sm text-ink placeholder:text-ink-3 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2.5">
          <span className="text-xs text-ink-3 mr-1">Add TLDs to bare names:</span>
          {EXPANDABLE_TLDS.map((tld) => (
            <button
              key={tld}
              onClick={() => toggleTld(tld)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                tlds.includes(tld)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line text-ink-2 hover:border-ink-3"
              }`}
            >
              .{tld}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs tabular-nums text-ink-3">
            {parsed.length.toLocaleString()} / {MAX_DOMAINS.toLocaleString()} domains
          </span>
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
            onClick={() => handleInput(EXAMPLE_INPUT)}
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-2 hover:border-ink-3"
          >
            Example
          </button>
          {input && (
            <button
              onClick={() => handleInput("")}
              className="rounded-lg px-3 py-1.5 text-sm text-ink-3 hover:text-ink-2"
            >
              Clear
            </button>
          )}
          <div className="flex-1" />
          {phase === "checking" ? (
            <button
              onClick={stopCheck}
              className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink-2 hover:border-ink-3"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={() => runCheck(parsed)}
              disabled={parsed.length === 0}
              className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            >
              Check {parsed.length > 0 ? parsed.length.toLocaleString() : ""} domains
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {progress.total > 0 && (
        <div className="mt-4">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full bg-accent transition-[width] duration-200"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs tabular-nums text-ink-3">
            <span>
              {progress.done.toLocaleString()} / {progress.total.toLocaleString()}{" "}
              checked
            </span>
            {rate > 0 && (
              <span>
                {(progress.ms / 1000).toFixed(1)}s · {rate.toLocaleString()}{" "}
                domains/s
              </span>
            )}
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
