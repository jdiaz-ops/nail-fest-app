// Shared by RegistrationForm.tsx (the phone country-code picker) and
// SegmentComposer.tsx (the "País (código telefónico)" segment filter) —
// one list so a code never drifts between "what a person can register
// with" and "what an admin can filter a WhatsApp broadcast by". Colombia
// default since that's effectively the whole audience today (see
// docs/IMPORT.md), but Cúcuta specifically draws real Venezuelan traffic
// across the border — phonePlaceholder/idLabel/idPlaceholder below exist
// so the form actually adapts per country instead of always showing a
// Colombian phone example and "cédula - o - NIT" regardless of who's
// filling it out. These are HINTS only (grey placeholder text) — never
// enforced server-side, since real numbers/documents have enough
// exceptions that a hard format check would just block real people.
export interface CountryCodeOption {
  code: string;
  label: string;
  // Full Spanish country name — used by RegistrationForm.tsx's own "País"
  // question (the thing that actually drives countryCode now; label
  // above is the compact flag+code shown as the phone's fixed prefix).
  name: string;
  // Example local mobile number, in whatever grouping that country
  // actually writes it — shown as the phone input's placeholder once
  // this code is selected.
  phonePlaceholder: string;
  // Short name for "the ID document Colombia calls cédula/NIT", in that
  // country's own terms — shown as the cédula/NIT question's placeholder.
  // Not every country has a single unified term the way Colombia does
  // (cédula for a person, NIT for a company); idPlaceholder spells out
  // both halves where they differ.
  idPlaceholder: string;
}

export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: "+57", label: "🇨🇴 +57", name: "Colombia", phonePlaceholder: "321 1234567", idPlaceholder: "Ej: 1020304050 (cédula) o 900123456-7 (NIT de empresa)" },
  { code: "+52", label: "🇲🇽 +52", name: "México", phonePlaceholder: "55 1234 5678", idPlaceholder: "Ej: RFC o CURP" },
  { code: "+51", label: "🇵🇪 +51", name: "Perú", phonePlaceholder: "912 345 678", idPlaceholder: "Ej: 12345678 (DNI) o 20123456789 (RUC de empresa)" },
  { code: "+593", label: "🇪🇨 +593", name: "Ecuador", phonePlaceholder: "99 123 4567", idPlaceholder: "Ej: 1234567890 (cédula) o 1234567890001 (RUC de empresa)" },
  { code: "+507", label: "🇵🇦 +507", name: "Panamá", phonePlaceholder: "6123-4567", idPlaceholder: "Ej: 8-123-4567 (cédula) o RUC de empresa" },
  // Venezuela — same word as Colombia ("cédula de identidad"), but a
  // different prefix format and a different company ID (RIF, not NIT).
  // Every Venezuelan mobile starts with 04 + a 2-digit carrier code
  // (0412/0414/0424/0416/0426) + 7 digits.
  { code: "+58", label: "🇻🇪 +58", name: "Venezuela", phonePlaceholder: "0412 1234567", idPlaceholder: "Ej: V-12345678 (cédula) o J-123456789 (RIF de empresa)" },
  { code: "+56", label: "🇨🇱 +56", name: "Chile", phonePlaceholder: "9 1234 5678", idPlaceholder: "Ej: 12.345.678-9 (RUT)" },
  { code: "+54", label: "🇦🇷 +54", name: "Argentina", phonePlaceholder: "11 1234-5678", idPlaceholder: "Ej: 12345678 (DNI) o CUIT de empresa" },
  { code: "+34", label: "🇪🇸 +34", name: "España", phonePlaceholder: "612 345 678", idPlaceholder: "Ej: 12345678A (DNI/NIE) o CIF de empresa" },
  { code: "+1", label: "🇺🇸 +1", name: "Estados Unidos", phonePlaceholder: "(555) 123-4567", idPlaceholder: "Documento de identidad (si aplica)" },
];
