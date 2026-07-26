# Roadmap — bulkdomainsearch

Tout ce qui reste à faire, priorisé. Faits vérifiés en juillet 2026.
Convention du repo : les secrets serveur n'ont **pas** de préfixe (`SEDO_SIGN_KEY`,
`CZDS_PASSWORD`…), les liens d'affiliation exposés au client sont en
`NEXT_PUBLIC_AFF_*`. On ajoute une variable d'env dans Vercel → *Settings →
Environment Variables*, puis on redéploie.

Légende : ☐ à faire · 🧑 action toi (inscriptions) · 💻 action dev (code)

---

## ✅ Déjà fait et en ligne
- Recherche de dispo en masse (vert = libre, rouge = pris), streaming instantané
- Tier bleu « à vendre » (code complet) : index GoDaddy Auctions + API Sedo
- Input à chips colorées, tuiles de stats, import/export CSV
- PostHog (désactivé tant qu'il n'y a pas de clé), rate-limit par IP
- Déployé sur Vercel

---

## 🔴 Priorité 1 — Rendre le tier bleu visible en ligne

**Le problème** : Vercel est serverless (éphémère), donc l'index GoDaddy
Auctions (des centaines de milliers d'annonces) ne peut pas rester en mémoire.
Sur le déploiement actuel, le bleu est donc vide. Il faut sortir l'index dans
un **stockage externe** que l'API interroge.

**GoDaddy Auctions reste gratuit et sans clé en 2026** (`inventory.auctions.godaddy.com`,
`metadata.json` + fichiers zip quotidiens reconstruits ~14:30 UTC). Le script
`scripts/godaddy-auctions-download.mjs` fonctionne tel quel.

### Solution recommandée : Turso (SQLite hébergé) — ✅ CODE FAIT, il reste 3 clics
Le code est écrit et **testé de bout en bout** (`lib/aftermarket-store.ts`
bascule auto : fichier local en dev, Turso en prod ; `scripts/turso-load.mjs`
charge le feed ; `.github/workflows/aftermarket-sync.yml` le fait chaque nuit).
`@libsql/client` est déjà auto-externalisé par Next → rien à configurer côté build.

**Ce qu'il te reste à faire (10 min, ~gratuit) :**
- 🧑 ☐ Créer un compte gratuit sur **turso.tech**, créer 1 base, copier
  l'URL + le token
- 🧑 ☐ Les coller comme **secrets GitHub** du repo (*Settings → Secrets and
  variables → Actions*) : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- 🧑 ☐ Les coller aussi dans **Vercel** (*Settings → Environment Variables*) →
  redéployer
- 🧑 ☐ Lancer la GitHub Action une première fois à la main (onglet *Actions →
  Sync aftermarket feed to Turso → Run workflow*) ; ensuite elle tourne toute
  seule chaque nuit à 15:40 UTC

Une fois ces 4 étapes faites, les ~354k annonces GoDaddy s'affichent en bleu
sur ton site en ligne. ⚠️ ~350k lignes/nuit ≈ ~10M écritures/mois, soit le
plafond gratuit Turso — si tu le dépasses, réduis la liste de fichiers dans
`scripts/godaddy-auctions-download.mjs` ou prends le plan à 4,99 $/mo.

### Alternative : petit serveur toujours allumé (si tu préfères ne pas ré-architecturer)
On garde `lib/aftermarket-index.ts` **tel quel** dans un mini-serveur Hono,
avec le cron de download sur la même machine ; Vercel fait un seul `fetch`.
Meilleur choix si tu veux plus tard de la recherche floue/préfixe en mémoire.
- Hetzner CX22 (~4,49 €/mo, 4 Go RAM) si tu es à l'aise avec Linux, ou
  Fly.io (~4-7 $/mo, carte requise depuis 2024).
- Variables : `AFTERMARKET_API_URL`, `AFTERMARKET_API_TOKEN`

**À éviter** : Vercel KV (mort, migré vers Upstash), Vercel Blob (pas un
store clé/valeur), Upstash/Cloudflare KV en pay-as-you-go (le rechargement
nocturne complet fait exploser le coût des écritures).

---

## 🟢 Priorité 2 — Activer les revenus d'affiliation (registrars)

Chaque `NEXT_PUBLIC_AFF_*` doit contenir l'URL d'affiliation **complète** avec
`{domain}` là où va le domaine (seul `{domain}` est ré-encodé à l'exécution ;
le reste d'une URL de destination imbriquée doit être **pré-encodé**).

| Registrar | Réseau | Inscription | Commission (domaines) | Variable |
|---|---|---|---|---|
| **Namecheap** | Impact | namecheap.com/affiliates | 20 % (⚠️ 0 % sur premium) | `NEXT_PUBLIC_AFF_NAMECHEAP` |
| **GoDaddy** | CJ Affiliate | signup.cj.com → programme GoDaddy | ~10 % (⚠️ 0 % sur aftermarket/premium) | `NEXT_PUBLIC_AFF_GODADDY` |
| **Dynadot** | CJ (25 %) ou Ambassador (30 %) | dynadot.com/affiliate | 25-30 % | `NEXT_PUBLIC_AFF_DYNADOT` |
| **Porkbun** | — | **programme arrêté en 2026** | — | laisser vide |

Templates de deep-link vérifiés (remplace les `<...>` par tes IDs de dashboard) :

```
# Namecheap (Impact) — <IMPACT_ID> = ton media-partner id
NEXT_PUBLIC_AFF_NAMECHEAP=https://namecheap.pxf.io/c/<IMPACT_ID>/386170/5618?u=https%3A%2F%2Fwww.namecheap.com%2Fdomains%2Fregistration%2Fresults%2F%3Fdomain%3D{domain}

# GoDaddy (CJ) — <PID>=ton id site CJ, <AID>=id du deep-link GoDaddy
NEXT_PUBLIC_AFF_GODADDY=https://www.anrdoezrs.net/click-<PID>-<AID>?url=https%3A%2F%2Fwww.godaddy.com%2Fdomainsearch%2Ffind%3FdomainToCheck%3D{domain}

# Dynadot (CJ, recommandé pour le deep-link par domaine)
NEXT_PUBLIC_AFF_DYNADOT=https://www.anrdoezrs.net/click-<PID>-<AID>?url=https%3A%2F%2Fwww.dynadot.com%2Fdomain%2Fsearch%3Fdomain%3D{domain}

# Lien WHOIS des domaines pris (même wrap CJ GoDaddy, optionnel)
NEXT_PUBLIC_AFF_WHOIS=https://www.anrdoezrs.net/click-<PID>-<AID>?url=https%3A%2F%2Fwww.godaddy.com%2Fwhois%2Fresults.aspx%3Fdomain%3D{domain}
```

- 🧑 ☐ Namecheap : postuler (Impact), récupérer l'`IMPACT_ID`
- 🧑 ☐ GoDaddy : s'inscrire sur CJ, postuler au programme GoDaddy, générer un
  Deep Link → `PID` + `AID` (le domaine de tracking CJ peut varier :
  anrdoezrs.net / tkqlhce.com / dpbolvw.net — prends celui que CJ te donne)
- 🧑 ☐ Dynadot : choisir **CJ** (25 %, deep-link par domaine) plutôt
  qu'Ambassador (30 % mais lien qui redirige vers l'accueil, sans domaine)
- 🧑 ☐ Porkbun : le programme général est **arrêté** — laisser `NEXT_PUBLIC_AFF_PORKBUN`
  vide (l'app retombe sur le lien de recherche simple, non tracké)
- 💻 ☐ Supprimer / marquer « non tracké » les liens Namecheap & GoDaddy sur les
  domaines **premium** (ils paient 0 % dessus) — à faire quand le tier or arrive

---

## 🔵 Priorité 3 — Sedo (aftermarket live + affiliation)

Deux niveaux, le premier suffit pour toucher des commissions sans code.

**Niveau 1 — liens d'affiliation trackés (gratuit, immédiat, sans API) :**
- 🧑 ☐ Créer un compte Sedo gratuit → *Services → Sedo's Partner Program →
  Join Partner Program* (`sedo.com/member/partner/register.php`), entrer l'URL
  du site, accepter les CGU
- 🧑 ☐ Copier le **Partner ID** → `SEDO_PARTNER_ID`
- 🧑 ☐ Dans l'espace intégration (`sedo.com/member/partner/integration.php`),
  créer une campagne → copier le **Campaign ID** → `NEXT_PUBLIC_SEDO_CAMPAIGN_ID`
  ✅ ça allume déjà les liens d'offre trackés (15 % de la commission Sedo)

**Niveau 2 — prix « à vendre » live via l'API DomainStatus :**
- 🧑 ☐ Demander l'accès API par mail à **partner@sedo.com** depuis l'email du
  compte (préciser l'usage DomainStatus) → ils envoient le `SEDO_SIGN_KEY` ;
  demander aussi s'il faut whitelister une IP
- 💻 ✅ Bugs de parsing corrigés (devise ISO + regex `<item>` avec attributs) ;
  support optionnel `SEDO_USERNAME`/`SEDO_PASSWORD` ajouté au cas où l'API
  renvoie E5/E6/E12
- 💻 ☐ Après réception de la clé : faire **un** appel live pour valider le
  parsing avant de compter dessus (cap : 100 domaines/appel)

---

## 🟡 Priorité 4 — Autres marketplaces aftermarket (plus d'inventaire bleu)

- **Atom.com (ex-Squadhelp) — Cloud Broker** : self-serve, **aucun seuil**,
  20 % de la commission d'Atom, cookie 30 j. Le meilleur « prochain » ajout.
  - 🧑 ☐ Se connecter à Atom.com → menu Affiliate → Cloud Broker
    (`atom.com/cloud-broker/all`)
  - 💻 ☐ Ajouter un builder de lien checkout par domaine dans
    `lib/registrars.ts` (comme `sedoOfferUrl`), gated sur `NEXT_PUBLIC_AFF_ATOM`
- **Afternic (GoDaddy) — Referral Partner** : le plus gros stock de « buy now ».
  Pas de self-serve → formulaire de contact `afternic.com/partner`. Un site
  indé sans volume obtient le mode « click-over » (pas le feed quotidien, qui
  est réservé aux registrars). Commission négociée (non publiée).
  - 🧑 ☐ Postuler, demander le split de commission + si le feed DDN est
    accessible à ton volume
  - 💻 ☐ Prévoir `NEXT_PUBLIC_AFF_AFTERNIC` (lien click-over) et, si un feed est
    accordé, déposer un `afternic.ndjson` dans `data/aftermarket/` (même forme
    que `godaddy.ndjson`)
- ⚠️ **Dan.com est mort** (fermé le 27 juin 2025, tout redirige vers Afternic) —
  rien à intégrer.
- 💡 Les premiums Atom sont **déjà syndiqués dans le réseau Sedo** → si tu fais
  Sedo, certains apparaissent sans deal Atom séparé.

---

## 🥇 Priorité 5 — Tier or (premium de registre)

Domaines **libres** que le registre vend plus cher (nouveaux gTLD surtout ;
jamais sur .com). Nécessite une API de registrar qui renvoie un flag premium +
prix. À afficher en or, à côté du vert.

**Primaire recommandé — Name.com Core API** (gratuit, **pas de whitelist IP** →
marche sur Vercel, 50 domaines/appel) :
- endpoint `POST https://api.name.com/core/v1/domains:checkAvailability`,
  auth HTTP Basic `user:token`
- réponse par domaine : `purchasable`, `premium`, `purchasePrice`,
  `renewalPrice` → or = `purchasable && premium`
- 🧑 ☐ Compte Name.com gratuit → Account Settings → API → token
  → `NAMECOM_USERNAME`, `NAMECOM_API_TOKEN`
- 💻 ☐ Après qu'un domaine ressort `available`, batcher les libres par 50 vers
  Name.com côté serveur, mapper `premium:true` → statut `premium` (or) avec
  prix ; étendre `lib/types.ts` (statut `premium` + `registrationPrice`/
  `renewalPrice`/`currency`)

**Fallback — Spaceship API** (gratuit, auth par header, 20 domaines/appel ;
premium signalé par la présence de `premiumPricing[]`) →
`SPACESHIP_API_KEY`, `SPACESHIP_API_SECRET`.

**Namecheap** (champs premium les plus riches : `IsPremiumName` +
`PremiumRegistrationPrice`) mais **lourd** : exige ≥20 domaines / 50 $ de solde,
et surtout **whitelist IP** → impossible tel quel sur Vercel (pas d'IP fixe) ;
il faudrait un proxy à IP fixe (QuotaGuard ~19 $/mo ou petit VPS). À éviter au
début.

> ⚠️ `AGENTS.md` : ce Next.js est modifié — lire `node_modules/next/dist/docs/`
> avant de toucher au code des routes.

---

## ⚡ Priorité 6 — Vitesse maximale (zone files locaux, optionnel)

Pour répondre en <10 ms sans DNS (comme InstantDomainSearch) : indexer les
zone files ICANN CZDS. Même contrainte que le tier bleu → besoin d'un stockage
persistant / serveur toujours allumé, pas Vercel serverless.
- 🧑 ☐ Compte gratuit czds.icann.org, demander les zones (.com approuvé par
  Verisign) → `CZDS_USERNAME`, `CZDS_PASSWORD`
- 💻 ☐ `scripts/czds-download.mjs` en nightly (déjà écrit)

Sans ça, la dispo marche déjà très bien en DNS/DoH — c'est un bonus de latence,
pas un bloquant.

---

## 📊 Finitions
- 🧑 ☐ PostHog : `NEXT_PUBLIC_POSTHOG_KEY` (cloud EU conseillé) → toutes les stats
- 🧑 ☐ Domaine perso dans Vercel → *Settings → Domains*
- 💻 ☐ Quand le tier or existe : masquer les liens registrar qui paient 0 % sur
  les premiums

---

## Récap des variables d'env

| Variable | Rôle | Quand |
|---|---|---|
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | Store du tier bleu sur Vercel | P1 |
| `AFTERMARKET_API_URL` / `_TOKEN` | Alt. serveur toujours allumé | P1 (alt) |
| `NEXT_PUBLIC_AFF_NAMECHEAP` / `_GODADDY` / `_DYNADOT` / `_WHOIS` | Liens affiliés registrars | P2 |
| `SEDO_PARTNER_ID` / `NEXT_PUBLIC_SEDO_CAMPAIGN_ID` | Sedo liens trackés | P3 |
| `SEDO_SIGN_KEY` (+ `SEDO_USERNAME`/`SEDO_PASSWORD` si besoin) | Sedo API prix live | P3 |
| `NEXT_PUBLIC_AFF_ATOM` | Atom Cloud Broker | P4 |
| `NEXT_PUBLIC_AFF_AFTERNIC` | Afternic click-over | P4 |
| `NAMECOM_USERNAME` / `NAMECOM_API_TOKEN` | Tier or (primaire) | P5 |
| `SPACESHIP_API_KEY` / `SPACESHIP_API_SECRET` | Tier or (fallback) | P5 |
| `CZDS_USERNAME` / `CZDS_PASSWORD` | Zone files (vitesse) | P6 |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | Analytics | Finitions |

## Ordre conseillé
1. **Revenus faciles tout de suite** : Namecheap + GoDaddy + Dynadot (P2) et
   Sedo niveau 1 (P3) — que des inscriptions, zéro code, ton site gagne déjà.
2. **Le bleu live** : Turso (P1) — le seul vrai chantier dev.
3. **Plus d'inventaire** : Atom Cloud Broker (P4), Sedo niveau 2 (P3).
4. **Le tier or** : Name.com (P5).
5. **Bonus** : zone files (P6).
