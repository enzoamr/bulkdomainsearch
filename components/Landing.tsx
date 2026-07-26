"use client";

import { useEffect, useRef } from "react";

/**
 * Marketing sections rendered under the search tool — feature cards with
 * animated mockups, stats, playbook, use cases, workflow table, steps, FAQ.
 * Everything reveals on scroll (IntersectionObserver + .reveal CSS).
 */

const CHEVRON = (
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
    className="shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export default function Landing() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    for (const el of root.querySelectorAll("[data-reveal]")) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="mt-24">
      <Features />
      <Scale />
      <HowItWorks />
      <AfterTheSearch />
      <UseCases />
      <Workflows />
      <StepByStep />
      <Faq />
      <FinalCta />
    </div>
  );
}

/* ————— building blocks ————— */

function Section({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
      <div data-reveal className="reveal">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </div>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
          {title}
        </h2>
        {lead && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">
            {lead}
          </p>
        )}
      </div>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Card({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      data-reveal
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal rounded-2xl border border-line bg-surface p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5 ${className}`}
    >
      {children}
    </div>
  );
}

function Mock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-line bg-background p-4 font-mono text-xs leading-6 text-ink-2">
      {children}
    </div>
  );
}

/* ————— 1. Features ————— */

function Features() {
  return (
    <Section
      eyebrow="Powerful"
      title="Built for lists that break other tools"
      lead="Every step of the bulk workflow — from list import to registrar checkout — designed for speed and clarity at real-world scale."
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold text-ink">CSV import &amp; paste</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Drop a CSV or paste a list. Entries are validated, deduplicated, and
            cleaned as they load — bogus extensions are caught against the full
            IANA registry and bare names get an extension automatically.
          </p>
          <Mock>
            <div className="flex items-center gap-2 text-ink-3">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
              Shortlist_Domains.csv
            </div>
            <div className="mt-2 space-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate line-through decoration-bad/60">
                  getwicke!d.fast;
                </span>
                <span className="demo-blink shrink-0 text-ink-3">cleaning…</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">wickedfast.hub</span>
                <span className="shrink-0 text-ink-3">→ wickedfast.com</span>
              </div>
              <div className="flex items-center justify-between gap-3 opacity-45">
                <span className="truncate">wickedfast.com</span>
                <span className="shrink-0 text-ink-3">duplicate ✕</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate">wickedfast.app</span>
                <span className="shrink-0 text-good-text">✓</span>
              </div>
            </div>
          </Mock>
        </Card>

        <Card delay={60}>
          <h3 className="text-base font-semibold text-ink">
            Real-time availability grid
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Green, blue, or red — live registry data resolved in parallel and
            streamed over a single connection. Scroll a thousand-domain list
            without a spinner in sight.
          </p>
          <Mock>
            <div className="space-y-1">
              {(
                [
                  ["madeyoulook.com", "bg-bad", "Lookup", "text-bad-text", 0],
                  ["dagger.online", "bg-good", "Register", "text-good-text", 700],
                  ["footpath.org", "bg-good", "Register", "text-good-text", 1400],
                  ["agenda.me", "bg-sale", "$999", "text-sale-text", 2100],
                ] as const
              ).map(([name, bar, label, cls, delay]) => (
                <div
                  key={name}
                  className="demo-row flex items-center gap-2.5"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <span className={`h-4 w-1 shrink-0 rounded-full ${bar}`} />
                  <span className="flex-1 truncate text-ink">{name}</span>
                  <span className={`shrink-0 font-sans font-medium ${cls}`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Mock>
        </Card>

        <Card delay={40}>
          <h3 className="text-base font-semibold text-ink">
            Advanced filtering &amp; sorting
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Filter by status, TLD, or price range. Sort alphabetically or by
            length to zero in on brandable or budget-friendly picks.
          </p>
          <Mock>
            <div className="flex flex-wrap gap-1.5 font-sans">
              <span className="rounded-full border border-accent px-2.5 py-0.5 text-accent">
                Sort A–Z
              </span>
              <span className="rounded-full border border-line px-2.5 py-0.5">
                By length
              </span>
              <span className="rounded-full border border-line px-2.5 py-0.5">
                .com
              </span>
              <span className="rounded-full border border-line px-2.5 py-0.5">
                .io
              </span>
              <span className="rounded-full border border-line px-2.5 py-0.5">
                .app
              </span>
            </div>
            <div className="mt-4 font-sans">
              <div className="relative h-4">
                <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
                <div className="absolute left-[10%] right-[12%] top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent" />
                <span className="demo-thumb absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_2px_var(--surface)]" />
                <span className="absolute right-[12%] top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_2px_var(--surface)]" />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
                <span>Min: 20</span>
                <span>Max: 50M</span>
              </div>
            </div>
          </Mock>
        </Card>

        <Card delay={100}>
          <h3 className="text-base font-semibold text-ink">
            Aftermarket prices &amp; export
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Registered doesn&apos;t mean unavailable — millions of for-sale
            listings are indexed with asking prices shown inline. Buy in one
            click, or export the full result set as CSV for the team.
          </p>
          <Mock>
            <div className="space-y-1">
              {(
                [
                  ["nastyfast.com", "$4,695"],
                  ["wickedlyfast.com", "$12,995"],
                  ["evilfast.com", "$1,499"],
                ] as const
              ).map(([name, price]) => (
                <div key={name} className="flex items-center gap-2.5">
                  <span className="h-4 w-1 shrink-0 rounded-full bg-sale" />
                  <span className="flex-1 truncate text-ink">{name}</span>
                  <span className="shrink-0 font-sans font-semibold text-sale-text">
                    {price}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-sans text-ink-2">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Export CSV
            </div>
          </Mock>
        </Card>
      </div>
    </Section>
  );
}

/* ————— 2. Scale ————— */

function Scale() {
  const stats = [
    {
      value: "5,000",
      label: "domains per batch",
      sub: "Paste or upload. Free, no signup, no per-user limits.",
    },
    {
      value: "1,400+",
      label: "TLDs validated",
      sub: "Every IANA-listed gTLD, ccTLD, and new TLD.",
    },
    {
      value: "20+",
      label: "registrars compared",
      sub: "Checkout links straight from the results.",
    },
    {
      value: "<100ms",
      label: "per-domain lookup",
      sub: "Zone-file index + parallel DNS — no cached answers.",
    },
  ];
  return (
    <Section
      eyebrow="Scale"
      title="Check up to 5,000 domains — free, no signup"
      lead="Built to run bulk searches at the scale brand-protection sweeps, portfolio audits, and keyword exploration actually need."
    >
      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            data-reveal
            style={{ transitionDelay: `${i * 70}ms` }}
            className="reveal rounded-2xl border border-line bg-surface p-6"
          >
            <div className="text-3xl font-semibold tracking-tight text-accent sm:text-4xl">
              {s.value}
            </div>
            <div className="mt-1 text-sm font-medium text-ink">{s.label}</div>
            <p className="mt-2 text-xs leading-relaxed text-ink-3">{s.sub}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ————— 3. How it works ————— */

function HowItWorks() {
  const steps = [
    {
      title: "Paste or upload a list",
      body: "Drop a CSV or paste thousands of names — with or without extensions. Bare names get .com automatically.",
    },
    {
      title: "Checks stream in live",
      body: "Zone-file index first, then parallel DNS with DoH fallback. Every answer arrives the moment it resolves.",
    },
    {
      title: "Filter by status, TLD, price",
      body: "Slice the grid by availability, extension, or price range to surface the shortlist worth acting on.",
    },
    {
      title: "Export CSV or buy in one click",
      body: "Download the full set for the team, or open registrar checkout for the winners straight from the grid.",
    },
  ];
  return (
    <Section
      eyebrow="How it works"
      title="From a list of names to a shortlist of domains"
      lead="Bulk domain search — also called a mass, batch, or multi-domain checker — handles the whole loop from list input to registrar checkout, without the one-at-a-time grind."
    >
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <ol className="space-y-6">
          {steps.map((s, i) => (
            <li
              key={s.title}
              data-reveal
              style={{ transitionDelay: `${i * 70}ms` }}
              className="reveal flex gap-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent">
                {i + 1}
              </span>
              <div>
                <div className="font-medium text-ink">{s.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div data-reveal className="reveal" style={{ transitionDelay: "120ms" }}>
          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between text-xs text-ink-3">
              <span className="font-medium uppercase tracking-wide">
                Bulk search preview
              </span>
              <span className="tabular-nums">6 of 1,248 results</span>
            </div>
            <div className="relative mt-4 space-y-1 font-mono text-xs">
              {(
                [
                  ["madeyoulook.com", "bg-bad", "Lookup", "text-bad-text"],
                  ["dagger.online", "bg-good", "Register", "text-good-text"],
                  ["footpath.org", "bg-good", "Register", "text-good-text"],
                  ["pallet.co", "bg-good", "Register", "text-good-text"],
                  ["burrow.online", "bg-bad", "Lookup", "text-bad-text"],
                  ["agenda.me", "bg-sale", "$999", "text-sale-text"],
                ] as const
              ).map(([name, bar, label, cls]) => (
                <div
                  key={name}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5"
                >
                  <span className={`h-4 w-1 shrink-0 rounded-full ${bar}`} />
                  <span className="flex-1 truncate text-ink">{name}</span>
                  <span className={`shrink-0 font-sans font-medium ${cls}`}>
                    {label}
                  </span>
                </div>
              ))}
              <div
                aria-hidden="true"
                className="demo-scan pointer-events-none absolute inset-x-0 top-0 h-7 rounded-md bg-accent/10"
              />
            </div>
            <div className="mt-4 border-t border-line pt-3 text-center font-sans text-xs text-ink-3">
              Export CSV (1,248 domains)
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ————— 4. After the search ————— */

function AfterTheSearch() {
  const cards = [
    {
      title: "Available",
      tone: "text-good-text",
      bar: "bg-good",
      tag: "Standard-priced & ready to register.",
      body: "Open registrar checkout straight from the grid. Compare prices before you commit — differences on the same TLD often exceed $20/year, and renewal rates rarely match the first-year offer.",
    },
    {
      title: "For sale",
      tone: "text-sale-text",
      bar: "bg-sale",
      tag: "Registered, but listed for resale.",
      body: "The asking price shows inline, pulled from indexed marketplace listings. Compare it with similar aftermarket sales and factor in escrow fees before reaching out.",
    },
    {
      title: "Taken",
      tone: "text-bad-text",
      bar: "bg-bad",
      tag: "Already registered, not listed.",
      body: "Click through for WHOIS — registrar, age, and expiry. Worth watching if the name might drop, or worth an offer if it's parked and idle.",
    },
  ];
  return (
    <Section
      eyebrow="After the search"
      title="Available, for sale, or taken — what to do with each"
      lead="Scanning the color grid is fast. The real work is deciding what to act on. Here's the playbook for each status."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((c, i) => (
          <Card key={c.title} delay={i * 70}>
            <div className="flex items-center gap-2.5">
              <span className={`h-5 w-1.5 rounded-full ${c.bar}`} />
              <h3 className={`text-base font-semibold ${c.tone}`}>{c.title}</h3>
            </div>
            <div className="mt-2 text-xs font-medium uppercase tracking-wide text-ink-3">
              {c.tag}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">{c.body}</p>
          </Card>
        ))}
      </div>
      <div
        data-reveal
        className="reveal mt-6 rounded-2xl border border-accent/30 bg-accent/5 px-6 py-4 text-sm leading-relaxed text-ink-2"
      >
        Every result resolves against the same live DNS and registry data your
        registrar uses at checkout — no cached answers — and any
        &ldquo;available&rdquo; can be confirmed against the registry itself via
        RDAP.
      </div>
    </Section>
  );
}

/* ————— 5. Use cases ————— */

function UseCases() {
  const cases = [
    {
      title: "Digital marketing agencies",
      body: "Run competitor sweeps, campaign variations, and landing-page checks across dozens of clients. Export branded CSVs for approval and shave hours off every client project.",
    },
    {
      title: "Domain investors & portfolio managers",
      body: "Bulk-check availability across trending keywords, triage expiring portfolios, and spot aftermarket bargains before competitors do.",
    },
    {
      title: "Enterprise brand protection",
      body: "Secure your brand across every major TLD at once. Monitor typosquats, check ccTLDs for international variations, and sweep trademarks across the full extension list.",
    },
    {
      title: "Startups & entrepreneurs",
      body: "Test hundreds of potential brand names instantly. Check .com alongside .io, .ai, and .app — and lock the name before the pitch deck ships.",
    },
    {
      title: "Web development agencies",
      body: "Check availability live during client kickoff calls. Present options, verify as you brainstorm, and buy approved names on the spot.",
    },
    {
      title: "SEO & expired-domain hunters",
      body: "Shortlist candidate domains in one batch and cross-reference the for-sale tier to surface buyable names that already carry equity.",
    },
  ];
  return (
    <Section
      eyebrow="Use cases"
      title="Six ways teams run bulk searches"
      lead="Pick the workflow closest to your job — each card describes the use case, and the table below shows rough list sizes and the features that matter most."
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cases.map((c, i) => (
          <Card key={c.title} delay={i * 50}>
            <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{c.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

/* ————— 6. Workflows table ————— */

function Workflows() {
  const rows = [
    ["Brand variation check (typo + plural + hyphen)", "30–80", "~2 hours", "Filter by TLD, export CSV"],
    ["TLD stack across a single brand name", "15–25", "~45 min", "Status filter, registrar links"],
    ["Portfolio expiry audit", "100–1,000", "8+ hours", "CSV import, copy available"],
    ["Keyword exploration for SEO", "200–2,000", "1–2 days", "Sort by length, price filter"],
    ["Aftermarket acquisition shortlist", "500–5,000", "2+ days", "Price range, for-sale filter"],
    ["Brand protection / trademark sweep", "50–200", "~3 hours", "Country TLDs, export CSV"],
  ];
  return (
    <Section
      eyebrow="Workflows"
      title="Common bulk search workflows"
      lead="Rough list sizes, time savings, and the features that matter most — so you can pick the right workflow for the job at hand."
    >
      <div data-reveal className="reveal overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[680px] border-collapse bg-surface text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-3">
              <th className="px-5 py-3.5 font-medium">Workflow</th>
              <th className="px-5 py-3.5 font-medium">List size</th>
              <th className="px-5 py-3.5 font-medium">Time saved</th>
              <th className="px-5 py-3.5 font-medium">Best features</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r[0]}
                className="border-b border-line transition-colors last:border-0 hover:bg-ink/5"
              >
                <td className="px-5 py-3.5 font-medium text-ink">{r[0]}</td>
                <td className="px-5 py-3.5 tabular-nums text-ink-2">{r[1]}</td>
                <td className="px-5 py-3.5 text-ink-2">{r[2]}</td>
                <td className="px-5 py-3.5 text-ink-2">{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ————— 7. Step by step ————— */

function StepByStep() {
  const steps = [
    {
      title: "Build your domain list",
      body: "One name per line — spaces, punctuation, and www. prefixes are stripped automatically. Mix entries with and without extensions freely.",
    },
    {
      title: "Cover the variations",
      body: "Add typos, plurals, and hyphenations of the names you care about. Brand sweeps live or die on the variations you didn't think to check.",
    },
    {
      title: "Stack your TLDs",
      body: "Type the same name with several extensions (.com, .io, .ai, .app) to compare an entire TLD stack side by side.",
    },
    {
      title: "Paste or upload",
      body: "Drop the list into the box or import a CSV. Validation and dedup run as it loads — up to 5,000 domains per batch.",
    },
    {
      title: "Scan the grid",
      body: "Hit the arrow and watch the color grid fill in live: green available, blue for sale with its price, red taken.",
    },
    {
      title: "Sort for the signal",
      body: "A–Z for grouped brands, by length for the shortest names, price range when you're hunting aftermarket value.",
    },
    {
      title: "Shortlist and copy",
      body: "Filter to Available, copy the whole list in one click, or export the full result set as CSV for the team.",
    },
    {
      title: "Buy through a registrar",
      body: "Every green name links straight into registrar checkout; every blue one deep-links to its marketplace listing.",
    },
  ];
  return (
    <Section
      eyebrow="Step by step"
      title="How to run a bulk domain search"
      lead="Every step of the bulk workflow — from list import to registrar checkout — designed for speed and clarity at real-world scale."
    >
      <ol className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
        {steps.map((s, i) => (
          <li
            key={s.title}
            data-reveal
            style={{ transitionDelay: `${(i % 2) * 60}ms` }}
            className="reveal flex gap-4"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold text-accent">
              {i + 1}
            </span>
            <div>
              <div className="font-medium text-ink">{s.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ————— 8. FAQ ————— */

function Faq() {
  const faqs = [
    {
      q: "What is bulk domain search and why use it?",
      a: "Bulk domain search is the fastest way to check availability for a whole list of domains at once, instead of one name at a time. Paste or upload up to 5,000 domains and see live availability, aftermarket prices, and registrar links in a single view — useful for brand-protection sweeps, portfolio audits, and keyword exploration.",
    },
    {
      q: "How many domains can I check at once — is there a limit?",
      a: "Up to 5,000 domains per batch, free. For longer lists, run consecutive batches — checks run in parallel against live DNS, so thousands of domains resolve in seconds.",
    },
    {
      q: "Is this bulk domain checker free?",
      a: "Yes — every feature is free with no signup. No paywall, no credit card, no upgrade path blocking bulk checks.",
    },
    {
      q: "How do I check multiple domain names at once?",
      a: "Paste your domains into the box (spaces, commas, or one per line) or drop a CSV file. You can mix entries with extensions (example.com) and without (example) — bare names get .com automatically, and invalid extensions are corrected against the official IANA list.",
    },
    {
      q: "How accurate are the results?",
      a: "Every answer resolves against live DNS — the same registry data your registrar uses at checkout, never a cached copy. When we can't get a definitive answer, we show the domain as taken rather than risk a false 'available', and results can be confirmed against the registry itself via RDAP.",
    },
    {
      q: "What do the three colors mean?",
      a: "Green = available to register at standard prices. Blue = registered but listed for sale on the aftermarket, with the asking price shown inline. Red = registered and not listed; click through for the WHOIS details.",
    },
    {
      q: "Where do the for-sale prices come from?",
      a: "From an index of millions of live marketplace listings, refreshed daily — auctions, closeouts, and buy-now inventory — plus direct marketplace lookups. Each blue result deep-links to the listing so you can buy or bid directly.",
    },
    {
      q: "Can I save or export my results?",
      a: "Yes — export the full result set as CSV (domain, status, price, marketplace, link) or copy every available name to the clipboard in one click.",
    },
    {
      q: "What file format should I use for import?",
      a: "CSV or plain text with one domain per line. Entries can include an extension or just the base name; whitespace, punctuation, and www. prefixes are stripped automatically before the batch runs.",
    },
    {
      q: "Is bulk domain search good for brand protection?",
      a: "It's one of the highest-leverage uses. Paste your brand plus common typos, plurals, hyphenations, and every TLD you care about. Export the taken rows as your monitoring list and the available rows as your acquisition list.",
    },
  ];
  return (
    <Section eyebrow="FAQ" title="Bulk domain search FAQ">
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <details
            key={f.q}
            data-reveal
            style={{ transitionDelay: `${Math.min(i * 30, 150)}ms` }}
            className="reveal group rounded-xl border border-line bg-surface px-5 transition-colors hover:border-ink-3"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
              {f.q}
              {CHEVRON}
            </summary>
            <p className="pb-5 text-sm leading-relaxed text-ink-2">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/* ————— 9. Final CTA ————— */

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">
      <div
        data-reveal
        className="reveal rounded-3xl border border-line bg-surface px-6 py-12 text-center sm:py-16"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Ready to run yours?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-ink-2 sm:text-base">
          Paste your list — up to 5,000 domains — and watch availability stream
          in live. Free, no signup.
        </p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-7 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
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
            <path d="m5 12 7-7 7 7" />
            <path d="M12 19V5" />
          </svg>
          Start a bulk search
        </button>
      </div>
    </section>
  );
}
