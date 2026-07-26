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
