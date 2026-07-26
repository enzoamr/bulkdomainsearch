# Zone-file index data

One file per TLD, named `{tld}.txt`, containing one registered second-level
name per line (no TLD suffix, lowercase):

```
# com.txt
google
github
example
```

`lib/zone-index.ts` loads every file in this directory into memory at first
request and answers availability checks from it with zero network calls —
if a name is absent from its TLD's file, it's available.

Populate and refresh nightly with `node scripts/czds-download.mjs` (see
`.env.example` for ICANN CZDS credentials). TLDs without a file here fall
back to live DNS automatically, so the app works fine with this directory
empty.

The `.txt` files are git-ignored — they are large, regenerated data.
