# Aftermarket index data (blue tier)

One `*.ndjson` file per marketplace, one normalized listing per line:

```json
{"domain":"example.com","market":"godaddy-auctions","price":50,"currency":"USD","type":"buyNow","url":"https://...","endsAt":"2026-07-26T16:00:00Z","valuation":29}
```

`lib/aftermarket-index.ts` loads every `.ndjson` here into memory at first
request and answers "is this domain for sale, at what price" with an O(1)
lookup and no network call — the same design as the zone-file index. When a
registered domain is found here, its status becomes `forsale` (blue) with the
price and a buy link.

- `godaddy.ndjson` — GoDaddy Auctions inventory (auctions + closeouts +
  expiring). Free, no key. Refresh nightly:
  `node scripts/godaddy-auctions-download.mjs`
- Other marketplaces (Afternic feed, an Atom export, …) can drop their own
  `{market}.ndjson` here in the same shape and they're picked up automatically.

Sedo is handled separately via its live API (`lib/sedo.ts`), not a file here.

The `.ndjson` files are git-ignored — large, regenerated data. This directory
can be empty; the blue tier simply stays quiet until a feed is present.
