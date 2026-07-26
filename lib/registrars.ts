/**
 * Registrar checkout links — the affiliate layer. Each registrar has a plain
 * search/checkout URL template with a {domain} placeholder; set the
 * NEXT_PUBLIC_AFF_* env vars to your affiliate deep-link templates (CJ for
 * GoDaddy, Impact for Namecheap, direct programs for Porkbun/Dynadot) and
 * they take over at build time. Client-safe: no Node imports.
 */

export interface Registrar {
  id: string;
  name: string;
  template: string;
}

const ENV_TEMPLATES: Record<string, string | undefined> = {
  namecheap: process.env.NEXT_PUBLIC_AFF_NAMECHEAP,
  godaddy: process.env.NEXT_PUBLIC_AFF_GODADDY,
  porkbun: process.env.NEXT_PUBLIC_AFF_PORKBUN,
  dynadot: process.env.NEXT_PUBLIC_AFF_DYNADOT,
};

const DEFAULTS: Registrar[] = [
  {
    id: "namecheap",
    name: "Namecheap",
    template:
      "https://www.namecheap.com/domains/registration/results/?domain={domain}",
  },
  {
    id: "godaddy",
    name: "GoDaddy",
    template: "https://www.godaddy.com/domainsearch/find?domainToCheck={domain}",
  },
  {
    id: "porkbun",
    name: "Porkbun",
    template: "https://porkbun.com/checkout/search?q={domain}",
  },
  {
    id: "dynadot",
    name: "Dynadot",
    template: "https://www.dynadot.com/domain/search?domain={domain}",
  },
];

export const REGISTRARS: Registrar[] = DEFAULTS.map((r) => ({
  ...r,
  template: ENV_TEMPLATES[r.id] || r.template,
}));

export function buyUrl(registrar: Registrar, domain: string): string {
  return registrar.template.replace("{domain}", encodeURIComponent(domain));
}

const WHOIS_TEMPLATE =
  process.env.NEXT_PUBLIC_AFF_WHOIS ||
  "https://www.godaddy.com/whois/results.aspx?domain={domain}";

/** WHOIS destination for taken domains (affiliate-wrappable via env). */
export function whoisUrl(domain: string): string {
  return WHOIS_TEMPLATE.replace("{domain}", encodeURIComponent(domain));
}

/**
 * Sedo aftermarket offer link. Add NEXT_PUBLIC_SEDO_CAMPAIGN_ID (from your
 * free Sedo Partner Program account) to attribute referred sales to you and
 * earn commission; without it the link still works, just untracked.
 */
export function sedoOfferUrl(domain: string): string {
  const campaignId = process.env.NEXT_PUBLIC_SEDO_CAMPAIGN_ID;
  const params = new URLSearchParams({ language: "us", domain });
  if (campaignId) params.set("campaignId", campaignId);
  return `https://sedo.com/checkdomainoffer.php?${params}`;
}
