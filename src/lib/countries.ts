// Country list + flag-emoji derivation. Flags are computed from the ISO code
// (regional-indicator letters), so we never store or type raw emoji by hand.

export function flagFromCode(code: string): string {
  if (!code || code.length !== 2) return "";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export const COUNTRIES: { code: string; name: string }[] = [
  { code: "SE", name: "Sweden" },
  { code: "IN", name: "India" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AU", name: "Australia" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CH", name: "Switzerland" },
  { code: "CN", name: "China" },
  { code: "DE", name: "Germany" },
  { code: "DK", name: "Denmark" },
  { code: "ES", name: "Spain" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "KE", name: "Kenya" },
  { code: "MX", name: "Mexico" },
  { code: "MY", name: "Malaysia" },
  { code: "NL", name: "Netherlands" },
  { code: "NO", name: "Norway" },
  { code: "NZ", name: "New Zealand" },
  { code: "PK", name: "Pakistan" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "QA", name: "Qatar" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SG", name: "Singapore" },
  { code: "TH", name: "Thailand" },
  { code: "TR", name: "Türkiye" },
  { code: "ZA", name: "South Africa" },
];

// International dial codes, keyed by the same ISO codes as COUNTRIES.
export const DIAL_CODES: Record<string, string> = {
  SE: "+46",
  IN: "+91",
  GB: "+44",
  US: "+1",
  AE: "+971",
  AU: "+61",
  BR: "+55",
  CA: "+1",
  CH: "+41",
  CN: "+86",
  DE: "+49",
  DK: "+45",
  ES: "+34",
  FI: "+358",
  FR: "+33",
  IE: "+353",
  IT: "+39",
  JP: "+81",
  KE: "+254",
  MX: "+52",
  MY: "+60",
  NL: "+31",
  NO: "+47",
  NZ: "+64",
  PK: "+92",
  PL: "+48",
  PT: "+351",
  QA: "+974",
  SA: "+966",
  SG: "+65",
  TH: "+66",
  TR: "+90",
  ZA: "+27",
};
