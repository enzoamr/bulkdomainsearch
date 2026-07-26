"use client";

import { useEffect, useRef } from "react";

/**
 * Marketing sections under the search tool, styled after Instant Domain
 * Search's bulk page: hairline-divided grids instead of boxed cards, lucide
 * icons inline with headings, window-style mockups clipped at the bottom,
 * a flat dl FAQ, and scroll-reveal animations.
 */

/* ————— lucide icons (stroke 1.5, matching IDS) ————— */

const ICON_PATHS: Record<string, React.ReactNode> = {
  "table-2": (
    <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
  ),
  "layout-grid": (
    <>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </>
  ),
  "sliders-horizontal": (
    <>
      <line x1="21" x2="14" y1="4" y2="4" />
      <line x1="10" x2="3" y1="4" y2="4" />
      <line x1="21" x2="12" y1="12" y2="12" />
      <line x1="8" x2="3" y1="12" y2="12" />
      <line x1="21" x2="16" y1="20" y2="20" />
      <line x1="12" x2="3" y1="20" y2="20" />
      <line x1="14" x2="14" y1="2" y2="6" />
      <line x1="8" x2="8" y1="10" y2="14" />
      <line x1="16" x2="16" y1="18" y2="22" />
    </>
  ),
  "hard-drive-download": (
    <>
      <path d="M12 2v8" />
      <path d="m16 6-4 4-4-4" />
      <rect width="20" height="8" x="2" y="14" rx="2" />
      <path d="M6 18h.01" />
      <path d="M10 18h.01" />
    </>
  ),
  group: (
    <>
      <path d="M3 7V5c0-1.1.9-2 2-2h2" />
      <path d="M17 3h2c1.1 0 2 .9 2 2v2" />
      <path d="M21 17v2c0 1.1-.9 2-2 2h-2" />
      <path d="M7 21H5c-1.1 0-2-.9-2-2v-2" />
      <rect width="7" height="5" x="7" y="7" rx="1" />
      <rect width="7" height="5" x="10" y="12" rx="1" />
    </>
  ),
  "swatch-book": (
    <>
      <path d="M11 17a4 4 0 0 1-8 0V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2Z" />
      <path d="M16.7 13H19a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H7" />
      <path d="M 7 17h.01" />
      <path d="m11 8 2.3-2.3a2.4 2.4 0 0 1 3.404.004L18.6 7.6a2.4 2.4 0 0 1 .026 3.434L9.9 19.8" />
    </>
  ),
  "dollar-sign": (
    <>
      <line x1="12" x2="12" y1="2" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  "clock-fading": (
    <>
      <path d="M12 2a10 10 0 0 1 7.38 16.75" />
      <path d="M12 6v6l4 2" />
      <path d="M2.5 8.875a10 10 0 0 0-.5 3" />
      <path d="M2.83 16a10 10 0 0 0 2.43 3.4" />
      <path d="M4.636 5.235a10 10 0 0 1 .891-.857" />
      <path d="M8.644 21.42a10 10 0 0 0 7.631-.38" />
    </>
  ),
  "clipboard-list": (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </>
  ),
  "list-filter": (
    <>
      <path d="M3 6h18" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  megaphone: (
    <>
      <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
      <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" />
      <path d="M8 6v8" />
    </>
  ),
  "chart-column": (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  "shield-check": (
    <>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  "laptop-minimal": (
    <>
      <rect width="18" height="12" x="3" y="4" rx="2" ry="2" />
      <line x1="2" x2="22" y1="20" y2="20" />
    </>
  ),
  flame: (
    <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />
  ),
  "locate-fixed": (
    <>
      <line x1="2" x2="5" y1="12" y2="12" />
      <line x1="19" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="5" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "list-tree": (
    <>
      <path d="M8 5h13" />
      <path d="M13 12h8" />
      <path d="M13 19h8" />
      <path d="M3 10a2 2 0 0 0 2 2h3" />
      <path d="M3 5v12a2 2 0 0 0 2 2h3" />
    </>
  ),
  "text-initial": (
    <>
      <path d="M15 5h6" />
      <path d="M15 12h6" />
      <path d="M3 19h18" />
      <path d="m3 12 3.553-7.724a.5.5 0 0 1 .894 0L11 12" />
      <path d="M3.92 10h6.16" />
    </>
  ),
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </>
  ),
  "arrow-down-a-z": (
    <>
      <path d="m3 16 4 4 4-4" />
      <path d="M7 20V4" />
      <path d="M20 8h-5" />
      <path d="M15 10V6.5a2.5 2.5 0 0 1 5 0V10" />
      <path d="M15 14h5l-5 6h5" />
    </>
  ),
  "badge-check": (
    <>
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  files: (
    <>
      <path d="M15 2h-4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8" />
      <path d="M16.706 2.706A2.4 2.4 0 0 0 15 2v5a1 1 0 0 0 1 1h5a2.4 2.4 0 0 0-.706-1.706z" />
      <path d="M5 7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h8a2 2 0 0 0 1.732-1" />
    </>
  ),
  x: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "arrow-up": (
    <>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
};

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

/* ————— scaffolding ————— */

function SectionHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <header data-reveal className="reveal mb-12 flex flex-col gap-6">
      <p className="font-mono text-xs font-medium uppercase tracking-[1px] text-accent">
        {eyebrow}
      </p>
      <div className="flex flex-col gap-4">
        <h2 className="text-3xl font-[550] leading-9 tracking-[-0.5px] text-ink">
          {title}
        </h2>
        {lead && (
          <p className="max-w-[715px] text-base leading-6 text-ink-2">{lead}</p>
        )}
      </div>
    </header>
  );
}

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
    <section className="relative mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
      <SectionHeader eyebrow={eyebrow} title={title} lead={lead} />
      {children}
    </section>
  );
}

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
    <div ref={rootRef} className="mt-20">
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

/* ————— 1. Features: hairline grid, window mockups ————— */

function FeatureCell({
  icon,
  title,
  body,
  mockup,
  className,
  delay = 0,
}: {
  icon: string;
  title: string;
  body: string;
  mockup: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      data-reveal
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal flex flex-col justify-between gap-8 pt-12 ${className ?? ""}`}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          <Icon name={icon} className="size-5 shrink-0 text-accent" />
          <h3 className="text-xl font-[550] leading-6 text-ink">{title}</h3>
        </div>
        <p className="text-base leading-6 text-ink-2">{body}</p>
      </div>
      <div className="flex justify-start">
        <div className="relative h-[200px] w-full max-w-[374px] overflow-hidden">
          <div className="h-full w-full overflow-hidden rounded-t-xl border border-b-0 border-line bg-gradient-to-br from-surface to-background p-4">
            {mockup}
          </div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <Section
      eyebrow="powerful"
      title="Built for lists that break other tools"
      lead="Every step of the bulk workflow — from list import to registrar checkout — designed for speed and clarity at real-world scale."
    >
      <div className="grid grid-cols-1 border-y border-line md:grid-cols-2">
        <FeatureCell
          icon="table-2"
          title="CSV import & paste"
          body="Drop a CSV or paste a list. Entries are validated, deduplicated, and cleaned as they load — bogus extensions are corrected against the IANA registry, with or without TLDs in the input."
          className="border-b border-line md:border-r md:pr-10"
          mockup={
            <div className="flex h-full flex-col gap-3 font-mono text-xs leading-6">
              <div className="flex w-fit items-center gap-2 whitespace-nowrap rounded-lg bg-ink/5 px-3 py-2">
                <Icon name="files" className="size-4 shrink-0 text-ink" />
                <span className="font-sans text-sm text-ink">
                  Shortlist_Domains.csv
                </span>
                <Icon name="x" className="size-3.5 shrink-0 text-ink-3" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-ink-2 line-through decoration-bad/60">
                    getwicke!d.fast;
                  </span>
                  <span className="demo-blink shrink-0 text-ink-3">cleaning…</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-ink-2">wickedfast.hub</span>
                  <span className="shrink-0 text-ink-3">→ wickedfast.com</span>
                </div>
                <div className="flex items-center justify-between gap-3 opacity-45">
                  <span className="truncate text-ink-2">wickedfast.com</span>
                  <span className="shrink-0 text-ink-3">duplicate</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-ink-2">wickedfast.app</span>
                  <span className="shrink-0 text-good-text">✓</span>
                </div>
              </div>
            </div>
          }
        />
        <FeatureCell
          icon="layout-grid"
          title="Real-time availability grid"
          body="Green, blue, or red — live registry data resolved in parallel and streamed over a single connection. Scroll a thousand-domain list without a spinner in sight."
          className="border-b border-line md:pl-10"
          delay={60}
          mockup={
            <div className="space-y-1.5 font-mono text-xs">
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
          }
        />
        <FeatureCell
          icon="list-filter"
          title="Advanced filtering & sorting"
          body="Filter by status, TLD, or price range. Sort alphabetically or by length to zero in on brandable or budget-friendly picks."
          className="border-b border-line pb-0 md:border-b-0 md:border-r md:pr-10"
          delay={40}
          mockup={
            <div className="font-sans text-xs">
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-accent px-2.5 py-0.5 text-accent">
                  Sort A–Z
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-2">
                  By length
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-2">
                  .com
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-2">
                  .io
                </span>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-ink-2">
                  .app
                </span>
              </div>
              <div className="mt-5">
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
            </div>
          }
        />
        <FeatureCell
          icon="hard-drive-download"
          title="Aftermarket prices & export"
          body="Registered doesn't mean unavailable — millions of for-sale listings are indexed with asking prices inline. Buy in one click, or export the full result set as CSV."
          className="md:pl-10"
          delay={100}
          mockup={
            <div className="font-mono text-xs">
              <div className="space-y-1.5">
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
              <div className="mt-4 flex w-fit items-center gap-2 rounded-lg bg-ink/5 px-3 py-2 font-sans text-ink-2">
                <Icon name="hard-drive-download" className="size-4 shrink-0" />
                Export CSV
              </div>
            </div>
          }
        />
      </div>
    </Section>
  );
}

/* ————— 2. Scale: icon + big number, no boxes ————— */

function Scale() {
  const stats = [
    {
      icon: "group",
      value: "5,000",
      label: "domains per batch",
      sub: "Paste or upload. Free, no signup, no per-user limits.",
    },
    {
      icon: "swatch-book",
      value: "1,400+",
      label: "TLDs validated",
      sub: "Every IANA-listed gTLD, ccTLD, and new TLD.",
    },
    {
      icon: "dollar-sign",
      value: "20+",
      label: "registrars compared",
      sub: "Checkout links straight from the results.",
    },
    {
      icon: "clock-fading",
      value: "<100ms",
      label: "per-domain lookup",
      sub: "Zone-file index + parallel DNS — no cached answers.",
    },
  ];
  return (
    <Section
      eyebrow="scale"
      title="Check up to 5,000 domains — free, no signup"
      lead="Built to run bulk searches at the scale brand-protection sweeps, portfolio audits, and keyword exploration actually need."
    >
      <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            data-reveal
            style={{ transitionDelay: `${i * 70}ms` }}
            className="reveal flex flex-col gap-6 py-10 md:pr-12"
          >
            <Icon name={s.icon} className="size-6 text-accent" />
            <div className="flex flex-col gap-1.5 text-ink">
              <dt className="text-3xl font-[550] leading-8 tracking-[-0.5px]">
                {s.value}
              </dt>
              <dd className="text-base font-medium leading-6">{s.label}</dd>
            </div>
            <p className="text-sm leading-5 text-ink-2">{s.sub}</p>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/* ————— 3. How it works: icon steps + preview panel ————— */

function HowItWorks() {
  const steps = [
    {
      icon: "clipboard-list",
      title: "Paste or upload a list",
      body: "Drop a CSV or paste thousands of names — with or without extensions. Bare names get .com automatically.",
    },
    {
      icon: "swatch-book",
      title: "Checks stream in live",
      body: "Zone-file index first, then parallel DNS with DoH fallback. Every answer arrives the moment it resolves.",
    },
    {
      icon: "list-filter",
      title: "Filter by status, TLD, price",
      body: "Slice the grid by availability, extension, or price range to surface the shortlist worth acting on.",
    },
    {
      icon: "hard-drive-download",
      title: "Export CSV or buy in one click",
      body: "Download the full set for the team, or open registrar checkout for the winners straight from the grid.",
    },
  ];
  return (
    <section className="relative mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
      <div className="grid gap-10 md:grid-cols-2 md:items-stretch md:gap-x-16">
        <div className="flex flex-col gap-10">
          <SectionHeader
            eyebrow="How it works"
            title="From a list of names to a shortlist of domains"
            lead="Bulk domain search — also called a mass, batch, or multi-domain checker — handles the whole loop from list input to registrar checkout, without the one-at-a-time grind."
          />
          <ul className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li
                key={s.title}
                data-reveal
                style={{ transitionDelay: `${i * 60}ms` }}
                className="reveal flex flex-col gap-3"
              >
                <Icon name={s.icon} className="size-5 text-accent" />
                <div className="flex flex-col gap-1 text-base leading-6">
                  <p className="font-semibold text-ink">{s.title}</p>
                  <p className="text-ink-2">{s.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div
          data-reveal
          className="reveal flex items-center"
          style={{ transitionDelay: "120ms" }}
        >
          <div className="w-full rounded-2xl border border-line bg-gradient-to-br from-surface to-background px-6 py-5">
            <p className="text-base font-medium leading-6 text-ink">
              Bulk search preview
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm leading-5 text-ink-3">
              <Icon name="list-filter" className="size-4 shrink-0" />
              <span className="flex-1">Sort</span>
              <span className="tabular-nums">6 of 1,248 results</span>
            </div>
            <div className="mt-3 space-y-1 font-mono text-xs">
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
            </div>
            <div className="mt-4 flex items-center justify-center gap-1.5 border-t border-line pt-4 font-sans text-xs text-ink-3">
              <Icon name="hard-drive-download" className="size-4 shrink-0" />
              Export CSV (1,248 domains)
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ————— 4. After the search: bar + heading, open grid ————— */

function AfterTheSearch() {
  const cards = [
    {
      title: "Available",
      bar: "bg-good",
      tag: "Standard-priced & ready to register.",
      body: "Open registrar checkout straight from the grid. Compare prices before you commit — differences on the same TLD often exceed $20/year, and renewal rates rarely match the first-year offer.",
    },
    {
      title: "For sale",
      bar: "bg-sale",
      tag: "Registered, but listed for resale.",
      body: "The asking price shows inline, pulled from indexed marketplace listings. Compare it with similar aftermarket sales and factor in escrow fees before reaching out.",
    },
    {
      title: "Taken",
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
      <div className="grid grid-cols-1 md:grid-cols-3">
        {cards.map((c, i) => (
          <div
            key={c.title}
            data-reveal
            style={{ transitionDelay: `${i * 70}ms` }}
            className="reveal flex flex-col gap-6 py-10 md:pr-12"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className={`w-1 self-stretch rounded-full ${c.bar}`}
              />
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold leading-7 text-ink">
                  {c.title}
                </h3>
                <p className="text-sm leading-5 text-ink-2">{c.tag}</p>
              </div>
            </div>
            <p className="text-sm leading-5 text-ink-2">{c.body}</p>
          </div>
        ))}
      </div>
      <footer
        data-reveal
        className="reveal mt-6 flex items-start gap-3 border-t border-line pt-8 text-sm leading-6"
      >
        <Icon name="locate-fixed" className="mt-0.5 size-5 shrink-0 text-accent" />
        <p className="text-ink-2">
          <span className="text-accent">Live-registry accuracy.</span> Every
          result resolves against the same DNS and registry data your registrar
          uses at checkout — no cached answers — and any &ldquo;available&rdquo;
          can be confirmed against the registry itself via RDAP.
        </p>
      </footer>
    </Section>
  );
}

/* ————— 5. Use cases: icon columns, no boxes ————— */

function UseCases() {
  const cases = [
    {
      icon: "megaphone",
      title: "Digital marketing agencies",
      body: "Run competitor sweeps, campaign variations, and landing-page checks across dozens of clients. Export branded CSVs for approval and shave hours off every client project.",
    },
    {
      icon: "chart-column",
      title: "Domain investors & portfolio managers",
      body: "Bulk-check availability across trending keywords, triage expiring portfolios, and spot aftermarket bargains before competitors do.",
    },
    {
      icon: "shield-check",
      title: "Enterprise brand protection",
      body: "Secure your brand across every major TLD at once. Monitor typosquats, check ccTLDs for international variations, and sweep trademarks across the full extension list.",
    },
    {
      icon: "rocket",
      title: "Startups & entrepreneurs",
      body: "Test hundreds of potential brand names instantly. Check .com alongside .io, .ai, and .app — and lock the name before the pitch deck ships.",
    },
    {
      icon: "laptop-minimal",
      title: "Web development agencies",
      body: "Check availability live during client kickoff calls. Present options, verify as you brainstorm, and buy approved names on the spot.",
    },
    {
      icon: "flame",
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
      <div className="grid grid-cols-1 md:grid-cols-3">
        {cases.map((c, i) => (
          <div
            key={c.title}
            data-reveal
            style={{ transitionDelay: `${(i % 3) * 60}ms` }}
            className="reveal flex flex-col gap-4 py-10 md:pr-12"
          >
            <Icon name={c.icon} className="size-6 text-accent" />
            <h3 className="text-lg font-medium leading-7 text-ink">{c.title}</h3>
            <p className="text-base leading-6 text-ink-2">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ————— 6. Workflows: hairline rows with icon header ————— */

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
      <div data-reveal className="reveal overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex items-center gap-1.5 px-4 py-4 text-ink-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Icon name="route" className="size-4 shrink-0" />
              <span className="text-sm font-medium leading-5">Workflow</span>
            </div>
            <div className="flex w-[100px] shrink-0 items-center gap-2 lg:w-[130px]">
              <Icon name="group" className="size-4 shrink-0" />
              <span className="text-sm font-medium leading-5">List size</span>
            </div>
            <div className="flex w-[110px] shrink-0 items-center gap-2 lg:w-[130px]">
              <Icon name="clock-fading" className="size-4 shrink-0" />
              <span className="text-sm font-medium leading-5">Time saved</span>
            </div>
            <div className="flex w-[220px] shrink-0 items-center gap-2 lg:w-[260px]">
              <Icon name="flame" className="size-4 shrink-0" />
              <span className="text-sm font-medium leading-5">Best features</span>
            </div>
          </div>
          {rows.map((r) => (
            <div
              key={r[0]}
              className="flex items-center gap-1.5 border-t border-line px-4 py-4 text-sm leading-5"
            >
              <p className="min-w-0 flex-1 font-medium text-accent">{r[0]}</p>
              <p className="w-[100px] shrink-0 tabular-nums text-ink lg:w-[130px]">
                {r[1]}
              </p>
              <p className="w-[110px] shrink-0 text-ink lg:w-[130px]">{r[2]}</p>
              <p className="w-[220px] shrink-0 text-ink-2 lg:w-[260px]">{r[3]}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

/* ————— 7. Step by step: icon accordions ————— */

function StepByStep() {
  const steps = [
    {
      icon: "list-tree",
      title: "Build your domain list",
      body: "One name per line — spaces, punctuation, and www. prefixes are stripped automatically. Mix entries with and without extensions freely.",
    },
    {
      icon: "text-initial",
      title: "Cover the variations",
      body: "Add typos, plurals, and hyphenations of the names you care about. Brand sweeps live or die on the variations you didn't think to check.",
    },
    {
      icon: "swatch-book",
      title: "Stack your TLDs",
      body: "Type the same name with several extensions (.com, .io, .ai, .app) to compare an entire TLD stack side by side.",
    },
    {
      icon: "upload",
      title: "Paste or upload",
      body: "Drop the list into the box or import a CSV. Validation and dedup run as it loads — up to 5,000 domains per batch.",
    },
    {
      icon: "layout-grid",
      title: "Scan the grid",
      body: "Hit the arrow and watch the color grid fill in live: green available, blue for sale with its price, red taken.",
    },
    {
      icon: "arrow-down-a-z",
      title: "Sort for the signal",
      body: "A–Z for grouped brands, by length for the shortest names, price range when you're hunting aftermarket value.",
    },
    {
      icon: "clipboard-list",
      title: "Shortlist and copy",
      body: "Filter to Available, copy the whole list in one click, or export the full result set as CSV for the team.",
    },
    {
      icon: "badge-check",
      title: "Buy through a registrar",
      body: "Every green name links straight into registrar checkout; every blue one deep-links to its marketplace listing.",
    },
  ];
  return (
    <Section
      eyebrow="Step by step"
      title="How to run a bulk domain search — 8 steps"
      lead="Every step of the bulk workflow — from list import to registrar checkout — designed for speed and clarity at real-world scale."
    >
      <ol className="flex flex-col gap-4">
        {steps.map((s, i) => (
          <li
            key={s.title}
            data-reveal
            style={{ transitionDelay: `${Math.min(i * 30, 120)}ms` }}
            className="reveal"
          >
            <details
              className="group rounded-2xl border border-line px-5 py-3"
              open={i === 0}
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                <Icon name={s.icon} className="size-5 shrink-0 text-accent" />
                <span className="flex-1 text-base font-medium leading-6 text-ink">
                  {i + 1}. {s.title}
                </span>
                <Icon
                  name="chevron-down"
                  className="size-5 shrink-0 text-ink-3 transition-transform group-open:-rotate-180"
                />
              </summary>
              <div className="mt-3 text-sm leading-5 text-ink-2">
                <p>{s.body}</p>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ————— 8. FAQ: flat dl ————— */

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
    <section className="relative mx-auto w-full max-w-5xl px-4 py-16 sm:py-24">
      <h2
        data-reveal
        className="reveal mb-10 text-2xl font-medium tracking-normal text-ink md:text-3xl"
      >
        Bulk domain search FAQ
      </h2>
      <dl className="flex flex-col gap-8">
        {faqs.map((f, i) => (
          <div
            key={f.q}
            data-reveal
            style={{ transitionDelay: `${Math.min(i * 30, 120)}ms` }}
            className="reveal flex flex-col gap-2"
          >
            <dt className="text-base font-medium text-ink">{f.q}</dt>
            <dd className="text-base leading-relaxed text-ink-2">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ————— 9. Final CTA ————— */

function FinalCta() {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-24 pt-8">
      <div
        data-reveal
        className="reveal flex flex-col items-start gap-6 border-t border-line pt-12"
      >
        <p className="font-mono text-xs font-medium uppercase tracking-[1px] text-accent">
          Ready?
        </p>
        <h2 className="text-3xl font-[550] leading-9 tracking-[-0.5px] text-ink">
          Run your bulk search
        </h2>
        <p className="max-w-[715px] text-base leading-6 text-ink-2">
          Paste your list — up to 5,000 domains — and watch availability stream
          in live. Free, no signup.
        </p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Icon name="arrow-up" className="size-4" />
          Start a bulk search
        </button>
      </div>
    </section>
  );
}
