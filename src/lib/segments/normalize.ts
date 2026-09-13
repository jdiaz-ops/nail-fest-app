// Pure segment-filter types + normalization — deliberately split out of
// builder.ts (which imports `db` and can't be pulled into a client
// component) so SegmentComposer.tsx can normalize a stored filter for its
// edit mode without bundling Prisma into the browser. builder.ts
// re-exports everything here for backward compatibility — every existing
// `from "@/lib/segments/builder"` import keeps working unchanged.

// Type-only — erased at compile time, so this stays true to the file's
// own "no Prisma runtime in the client bundle" rule above.
import type { ConsentPurpose } from "@prisma/client";

export type SegmentCondition =
  | { field: "event"; eventSlugs: string[] }
  | { field: "attended"; eventSlugs: string[] }
  | { field: "city"; cities: string[] }
  | { field: "profession"; professions: string[] }
  | { field: "label"; labels: string[] }
  // Derived from Person.phone's own country code prefix (E.164, e.g.
  // "+58..." for Venezuela) — for a WhatsApp broadcast the phone's
  // country is the one that actually matters (see RegistrationForm.tsx's
  // COUNTRY_CODES for the same list this reuses). `codes` holds the raw
  // prefixes ("+58"), not labels — OR'd together same as every other
  // multi-select condition. NOT the same as `country` below — a person
  // can live in one country and register with another's phone number,
  // see RegistrationForm.tsx's own comment on why those two are separate
  // fields now.
  | { field: "phoneCountry"; codes: string[] }
  // Person.country — a real, stored ISO2 (lib/worldCountries.ts) of
  // where they say they LIVE, filled from the registration form's own
  // required "País" question. `countries` holds ISO2 codes ("VE"), OR'd
  // together same as every other multi-select condition.
  | { field: "country"; countries: string[] }
  // "Personas que HOY tienen (o no tienen) consentimiento activo para
  // este canal" — rebotaron, se quejaron de spam, se desuscribieron, o
  // se importaron ya suprimidas (ver lib/consent.ts) todas terminan
  // igual: la última fila de Consent para ese purpose queda
  // granted:false. El mismo tipo de segmento que Brevo dejaba armar
  // ("bounces + unsubscribes"), y una forma de auditar directamente que
  // bulkActiveConsent (lo que de verdad gatea cada envío) está viendo lo
  // que uno espera, no solo confiar a ciegas en que ya excluye a alguien.
  // No es multi-select como los demás — un propósito + estado por
  // condición, ya que "marketing inactivo O whatsapp inactivo" no es un
  // caso real que este constructor necesite resolver hoy.
  | { field: "consent"; purpose: ConsentPurpose; state: "active" | "inactive" };

export interface SegmentFilter {
  include: SegmentCondition[];
  exclude: SegmentCondition[];
}

/**
 * Segments saved before multi-select existed are still sitting in the DB
 * with the old shape — one scalar value per condition (`eventSlug`/
 * `city`/`profession`, singular). Normalizing on every read here means
 * every consumer (resolveSegment in builder.ts, the Meta fast-path in
 * lib/meta/audiences.ts, and SegmentComposer's own edit-mode pre-fill)
 * keeps working on old AND new segments forever, with no migration
 * script and no risk of one silently mis-rewriting a real saved filter.
 * `raw` is deliberately untyped — it's whatever shape actually landed in
 * the JSON column, old or new.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeCondition(raw: any): SegmentCondition {
  switch (raw?.field) {
    case "event":
      return { field: "event", eventSlugs: raw.eventSlugs ?? (raw.eventSlug ? [raw.eventSlug] : []) };
    case "attended":
      return { field: "attended", eventSlugs: raw.eventSlugs ?? (raw.eventSlug ? [raw.eventSlug] : []) };
    case "city":
      return { field: "city", cities: raw.cities ?? (raw.city ? [raw.city] : []) };
    case "profession":
      return { field: "profession", professions: raw.professions ?? (raw.profession ? [raw.profession] : []) };
    case "label":
      return { field: "label", labels: raw.labels ?? [] };
    case "phoneCountry":
      return { field: "phoneCountry", codes: raw.codes ?? [] };
    case "country":
      return { field: "country", countries: raw.countries ?? [] };
    case "consent": {
      const validPurposes: ConsentPurpose[] = ["LOGISTICS", "MARKETING", "ADVERTISING", "WHATSAPP"];
      const purpose: ConsentPurpose = validPurposes.includes(raw.purpose) ? raw.purpose : "MARKETING";
      const state: "active" | "inactive" = raw.state === "active" ? "active" : "inactive";
      return { field: "consent", purpose, state };
    }
    default:
      throw new Error(`Unknown segment condition field: ${raw?.field}`);
  }
}

export function normalizeFilter(raw: SegmentFilter): SegmentFilter {
  return {
    include: raw.include.map(normalizeCondition),
    exclude: raw.exclude.map(normalizeCondition),
  };
}
