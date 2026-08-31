// Shared by RegistrationForm.tsx (the phone country-code picker) and
// SegmentComposer.tsx (the "País (código telefónico)" segment filter) —
// one list so a code never drifts between "what a person can register
// with" and "what an admin can filter a WhatsApp broadcast by". Colombia
// default since that's effectively the whole audience today (see
// docs/IMPORT.md), with a handful of other countries covered rather than
// forcing everyone else to mistype a Colombian number.
export interface CountryCodeOption {
  code: string;
  label: string;
}

export const COUNTRY_CODES: CountryCodeOption[] = [
  { code: "+57", label: "🇨🇴 +57" },
  { code: "+52", label: "🇲🇽 +52" },
  { code: "+51", label: "🇵🇪 +51" },
  { code: "+593", label: "🇪🇨 +593" },
  { code: "+507", label: "🇵🇦 +507" },
  { code: "+58", label: "🇻🇪 +58" },
  { code: "+56", label: "🇨🇱 +56" },
  { code: "+54", label: "🇦🇷 +54" },
  { code: "+34", label: "🇪🇸 +34" },
  { code: "+1", label: "🇺🇸 +1" },
];
