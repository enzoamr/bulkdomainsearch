# bulkdomainsearch

Bulk domain availability checker — paste up to 5,000 names or domains and
watch results stream in live. Built on the same architecture Instant Domain
Search describes in ["How we make it fast"](https://instantdomainsearch.com/learn/research/how-we-make-it-fast).

## Architecture

Checks run through three tiers, fastest first (`lib/dns.ts`):

| Tier | What | Latency |
|---|---|---|
| 1. Zone-file index | Registered names per TLD, synced nightly from ICANN CZDS and held in memory (`lib/zone-index.ts`) | ~0 ms, no network |
| 2. DNS NS query | Raw DNS (never WHOIS) — NXDOMAIN ⇒ available, delegation ⇒ taken; DNS-over-HTTPS fallback when UDP is blocked | a few ms |
| 3. RDAP | Registry-grade confirmation (Verisign RDAP for .com/.net, IANA bootstrap elsewhere) — the public equivalent of their live Verisign check | ~100–500 ms, on demand |

On top of availability, a registered domain is enriched with a **for-sale /
aftermarket tier** (the blue state, with a price):

| Tier | What | Latency |
|---|---|---|
| 4a. Aftermarket index | GoDaddy Auctions inventory (auctions, closeouts, expiring) synced daily and held in memory (`lib/aftermarket-index.ts`) — free, no key | ~0 ms, no network |
| 4b. Sedo live API | `DomainStatus` for-sale check for names not in a local feed (`lib/sedo.ts`) — needs a free Sedo Partner key | ~100–300 ms, on demand |

Result statuses: `available` (green), `forsale` (blue, with price + buy link),
`taken` (red), `unknown` (amber). The `/api/check` route runs a 48-wide worker
pool and **streams one NDJSON line per result over a single HTTP/2
connection**, so the UI renders each domain the moment its check completes.
Small batches check themselves as you type — no search button needed. The
route is rate-limited per IP (`lib/ratelimit.ts`) so a scraper can't drain the
DNS/registrar quotas.

Everything is stateless, so the app deploys to as many regions as you like
behind a geo-routing load balancer (Vercel, or Cloud Run + Google Cloud Load
Balancing, matching the original setup); each region loads its own copy of
the zone index.

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:3000, hit **Example**, and results stream in via DNS.

## Zone files (the big speedup)

1. Create a free account at [czds.icann.org](https://czds.icann.org) and
   request the zones you want (.com/.net are approved by Verisign; most
   gTLDs take a few days).
2. Copy `.env.example` to `.env.local` and set `CZDS_USERNAME` / `CZDS_PASSWORD`.
3. `node scripts/czds-download.mjs` (nightly via cron), which writes
   `data/zones/{tld}.txt`.

TLDs without a zone file (all ccTLDs — .fr, .io, .me, …) automatically fall
back to DNS, so the app is fully functional with no zone data at all.

## For-sale tier (aftermarket)

**GoDaddy Auctions — free, no key, ship today.** Run
`node scripts/godaddy-auctions-download.mjs` (nightly via cron; files rebuild
~14:30 UTC) to write `data/aftermarket/godaddy.ndjson`. Registered domains in
the feed then show up blue with their price and a buy link — indexed locally,
zero query-time latency, exactly like the zone files.

**Sedo — live for-sale prices, free affiliate revenue.** Join the free
[Sedo Partner Program](https://sedo.com/us/services/sedos-partner-program/),
then set `SEDO_PARTNER_ID` / `SEDO_SIGN_KEY` (for the `DomainStatus` API) and
`NEXT_PUBLIC_SEDO_CAMPAIGN_ID` (attributes referred sales → 15% of Sedo's
commission). Without these, Sedo is skipped and only the local feed drives the
blue tier. `lib/sedo.ts` is wired to Sedo's documented schema but should be
validated once you have a real partner key.

Next feeds to add (drop a `{market}.ndjson` into `data/aftermarket/`): Afternic
Referral Partner (biggest BIN inventory, apply at afternic.com/partner) and
Atom Cloud Broker (20% of commission).

## Affiliation

`lib/registrars.ts` builds the registrar checkout links (Namecheap, GoDaddy,
Porkbun, Dynadot). Set the `NEXT_PUBLIC_AFF_*` templates in `.env.local`
with your affiliate deep links (GoDaddy → CJ, Namecheap → Impact,
Porkbun/Dynadot → direct) and every buy link on available domains becomes an
affiliate link. Links carry `rel="sponsored"` and the footer discloses the
affiliation.

## Caveats

- A zone index is up to 24 h stale and DNS is a heuristic (a registered but
  undelegated domain looks available) — RDAP **Verify** is the source of
  truth before purchase.
- Public DoH resolvers rate-limit; for serious volume run your own resolver
  (e.g. unbound) next to the app and put its IP in `RESOLVER_IPS`.
- The .com zone is ~160M names (~16 GB RAM as a JS Set). Start with smaller
  TLDs, or swap the `Set` in `lib/zone-index.ts` for a bloom filter when you
  outgrow it.

## Analytics

Set `NEXT_PUBLIC_POSTHOG_KEY` (and optionally `NEXT_PUBLIC_POSTHOG_HOST`,
default EU cloud) to enable PostHog. Captured events: `domains_added`,
`domain_removed`, `check_completed`, `registrar_click` (with registrar,
status and placement), `verify_clicked`, `export_csv`, `copy_available`,
plus autocaptured pageviews and exceptions. No key → analytics fully off.
