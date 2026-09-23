"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { attributionFromSearchParams } from "@/lib/utm";
import { getValidFbc } from "./tracking";
import CityAutocomplete from "./CityAutocomplete";
import { isKnownCityLabel } from "@/lib/cityMatch";
import { suggestEmailCorrection } from "@/lib/emailTypo";
import { COUNTRY_CODES, GENERIC_PHONE_PLACEHOLDER, GENERIC_ID_PLACEHOLDER, stripTrunkZero } from "@/lib/countryCodes";
import { WORLD_COUNTRIES, findCountry } from "@/lib/worldCountries";

export interface QuestionView {
  key: string;
  label: string;
  type: "TEXT" | "SELECT" | "RADIO" | "CHECKBOX" | "DATE" | "AGREEMENT";
  required: boolean;
  options: string[];
  locked: boolean;
  // fullName only — "Full name" (one field) vs. "First & Last Name" (two).
  nameFormat: "FULL" | "FIRST_LAST";
  // email only — ask twice to catch typos.
  confirmEmail: boolean;
}

// Everything /api/register accepts, built here and handed up to
// EventRegistration.tsx via onSubmitPayload — this component only
// collects and client-validates it; the actual POST (and the Purchase
// pixel that has to fire in step with it) lives in the parent, which
// also owns the post-submit confirmation screen.
export interface RegisterPayload {
  eventSlug: string;
  email: string;
  phone: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  emailConfirm?: string;
  city: string;
  profession: string;
  // País de residencia (ISO2, e.g. "CO") — a real, required, separately-
  // filterable field now, NOT derived from the phone's own dial code
  // (see RegistrationForm.tsx's own comment on the two selectors).
  country: string;
  customFields: Record<string, string>;
  consents: { logistics: boolean; marketing: boolean; advertising: boolean; whatsapp: boolean };
  attribution?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    fbclid?: string;
    ttclid?: string;
    gclid?: string;
  };
  fbc?: string;
  fbp?: string;
  ticketTypeId?: string;
  ticketCount?: number;
  // Set by EventRegistration.tsx at the real confirm moment (Resumen
  // step), not here — see its own comment on why.
  purchaseEventId?: string;
  // Honeypot — see the field's own comment further down and
  // /api/register's matching check. Always empty for a real person;
  // named `website` (a field bots commonly auto-fill, unlike something
  // that reads as obviously fake).
  website?: string;
}

interface Props {
  eventSlug: string;
  professionOptions: string[];
  questions: QuestionView[];
  ticketTypeId?: string;
  ticketCount?: number;
  // One combined step (Shopify-style) — this is the real submit now, not
  // a "review before submitting" hop. EventRegistration.tsx owns the
  // actual fetch(); this component only builds and client-validates the
  // payload, then hands it up.
  onSubmitPayload: (payload: RegisterPayload) => void;
  submitting: boolean;
  submitLabel: string;
}

// Now shared with SegmentComposer.tsx's "País (código telefónico)" filter
// — see src/lib/countryCodes.ts's own comment on why this moved out of
// this file.

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function byKey(questions: QuestionView[], key: string): QuestionView | undefined {
  return questions.find((q) => q.key === key);
}

// Red "*" next to a label/legend for a required field — same --danger
// token as error text and the delete button, not the brand accent (a
// required-field marker isn't a brand moment, it's a warning-adjacent one).
function Req({ required }: { required?: boolean }) {
  if (!required) return null;
  return (
    <span aria-hidden="true" style={{ color: "var(--danger)" }}>
      {" "}
      *
    </span>
  );
}

export default function RegistrationForm({
  eventSlug,
  professionOptions,
  questions,
  ticketTypeId,
  ticketCount,
  onSubmitPayload,
  submitting,
  submitLabel,
}: Props) {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // "no tiene sentido ahí tener el +57, es lo del celular. Ahí es
  // seleccionar el país, lo del celular es aparte" — País (dónde vive, un
  // campo real y obligatorio — ver Person.country) y el país del propio
  // celular (qué prefijo usa el NÚMERO, independiente de dónde viva la
  // persona) son dos cosas separadas ahora. Colombia preseleccionada en
  // ambos por default.
  const [country, setCountry] = useState("CO");
  const [phoneCountryIso2, setPhoneCountryIso2] = useState("CO");

  // "cuando seleccioné el país... el celular me obliga a que sea de
  // Venezuela. No me puede obligar, me preselecciona Venezuela... puedo
  // seleccionar otro celular" — cambiar País PRE-LLENA el celular como
  // conveniencia (alguien vive en Venezuela pero puede tener un celular
  // de Estados Unidos), pero el celular queda con su propio selector,
  // libre de cambiarse después sin que este efecto lo revierta — solo
  // reacciona a un cambio de País, no se re-ejecuta por su cuenta.
  useEffect(() => {
    setPhoneCountryIso2(country);
  }, [country]);

  const phoneCountry = findCountry(phoneCountryIso2) ?? WORLD_COUNTRIES[0]!;
  // El ejemplo de celular depende del PAÍS DEL CELULAR (qué prefijo usa
  // el número); el ejemplo de cédula/NIT/RIF/DNI depende del PAÍS DONDE
  // VIVE (qué le dice su propio país, sin importar de dónde sea su
  // celular). countryCodes.ts solo tiene datos verificados para un
  // puñado de países — el resto usa un texto genérico honesto, nunca un
  // formato inventado.
  const phoneHint = COUNTRY_CODES.find((c) => c.iso2 === phoneCountryIso2);
  const phonePlaceholder = phoneHint?.phonePlaceholder ?? GENERIC_PHONE_PLACEHOLDER;
  const idHint = COUNTRY_CODES.find((c) => c.iso2 === country);
  const idPlaceholder = idHint?.idPlaceholder ?? GENERIC_ID_PLACEHOLDER;
  // "¿hay posibilidad de tener un detector de correos mal redactados?" —
  // a live suggestion while typing (gmial.com -> ¿quisiste decir
  // gmail.com?), never a hard block — see emailTypo.ts's own comment.
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmailSuggestion(suggestEmailCorrection(e.currentTarget.value));
  }

  function applyEmailSuggestion() {
    if (!emailSuggestion || !emailInputRef.current) return;
    emailInputRef.current.value = emailSuggestion;
    setEmailSuggestion(null);
  }

  // Real abandoned-cart tracking: the first moment we know who someone is,
  // before they've necessarily finished (or even started) the rest of the
  // form. Fire-and-forget, same pattern as tracking.ts's track() — never
  // blocks or errors the visible form. Whatever else is already filled in
  // (name, phone, city, profession) rides along too, best-effort, so a
  // draft that never gets a second look still carries something useful.
  // Never touches consent, never sends the ticket email, never fires Meta
  // CAPI — see /api/register/draft's own comment on why.
  function handleEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    const emailValue = e.currentTarget.value.trim();
    if (!emailValue || !emailValue.includes("@")) return; // not worth a round trip yet
    const form = e.currentTarget.form;
    if (!form) return;

    const fd = new FormData(form);
    const fullNameQuestion = questions.find((q) => q.key === "fullName");
    const usesFirstLast = fullNameQuestion?.nameFormat === "FIRST_LAST";
    const localPhone = String(fd.get("phone") ?? "").replace(/[^0-9]/g, "");
    const attribution = attributionFromSearchParams(searchParams);

    const body = {
      eventSlug,
      email: emailValue,
      phone: localPhone ? `${phoneCountry.dialCode}${stripTrunkZero(localPhone)}` : undefined,
      fullName: usesFirstLast ? undefined : String(fd.get("field_fullName") ?? "").trim() || undefined,
      firstName: usesFirstLast ? String(fd.get("field_firstName") ?? "").trim() || undefined : undefined,
      lastName: usesFirstLast ? String(fd.get("field_lastName") ?? "").trim() || undefined : undefined,
      city: String(fd.get("field_city") ?? "").trim() || undefined,
      profession: String(fd.get("field_profession") ?? "").trim() || undefined,
      country,
      ticketTypeId,
      ticketCount,
      utmSource: attribution?.utmSource,
      utmMedium: attribution?.utmMedium,
      utmCampaign: attribution?.utmCampaign,
    };

    fetch("/api/register/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* swallowed on purpose — see /api/register/draft's own comment */
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const form = new FormData(e.currentTarget);
    const localPhone = String(form.get("phone") ?? "").replace(/[^0-9]/g, "");
    const fullNameQuestion = questions.find((q) => q.key === "fullName");
    const emailQuestion = questions.find((q) => q.key === "email");
    const usesFirstLast = fullNameQuestion?.nameFormat === "FIRST_LAST";

    // customFields holds every question that isn't one of the four real
    // Person columns (email/fullName/phone/city/profession) — cedula,
    // whatever custom questions exist (Instagram by default, plus
    // anything added from /admin/settings/checkout-form), all keyed by
    // the question's own `key` so a saved answer always round-trips to
    // the same admin-configured question.
    const customFields: Record<string, string> = {};
    for (const q of questions.filter((q) => !q.locked || q.key === "cedula")) {
      if (q.type === "CHECKBOX") {
        // Multiple inputs share one name — join the checked ones so a
        // single string still fits Registration.customFields' shape.
        const values = form.getAll(`field_${q.key}`).map(String);
        if (values.length > 0) customFields[q.key] = values.join(", ");
      } else if (q.type === "AGREEMENT") {
        if (form.get(`field_${q.key}`) === "on") customFields[q.key] = "Sí";
      } else {
        const value = String(form.get(`field_${q.key}`) ?? "").trim();
        if (value) customFields[q.key] = value;
      }
    }

    const email = String(form.get("field_email") ?? "");

    const payload: RegisterPayload = {
      eventSlug,
      email,
      phone: localPhone ? `${phoneCountry.dialCode}${stripTrunkZero(localPhone)}` : "",
      // Only one of fullName or firstName/lastName is ever actually
      // populated below — sending both keys with one blank is fine,
      // /api/register only looks at firstName first, then falls back.
      fullName: usesFirstLast ? undefined : String(form.get("field_fullName") ?? ""),
      firstName: usesFirstLast ? String(form.get("field_firstName") ?? "").trim() : undefined,
      lastName: usesFirstLast ? String(form.get("field_lastName") ?? "").trim() : undefined,
      emailConfirm: emailQuestion?.confirmEmail ? String(form.get("field_emailConfirm") ?? "") : undefined,
      city: String(form.get("field_city") ?? ""),
      profession: String(form.get("field_profession") ?? ""),
      country,
      customFields,
      // No consent checkboxes at all anymore — LOGISTICS, MARKETING,
      // ADVERTISING and now WHATSAPP are all implicit in submitting the
      // form, covered by the acceptance line below the button (which
      // spells out the marketing/ads/WhatsApp authorization explicitly,
      // not just "terms" in the abstract). Still sent as four distinct
      // consents/Consent rows server-side — unchanged plumbing, only the
      // UI got simpler — so /api/unsubscribe can still revoke MARKETING
      // on its own later without touching ADVERTISING or WHATSAPP.
      consents: {
        logistics: true,
        marketing: true,
        advertising: true,
        whatsapp: true,
      },
      attribution: attributionFromSearchParams(searchParams),
      fbc: getValidFbc(),
      fbp: readCookie("_fbp"),
      ticketTypeId,
      ticketCount,
      website: String(form.get("website") ?? ""),
    };

    // Same typo-catching purpose as the second input itself — checked
    // client-side too so the person sees it immediately instead of a
    // round trip to the server.
    if (emailQuestion?.confirmEmail && payload.emailConfirm?.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setErrorMessage("Los correos no coinciden — revísalos.");
      return;
    }

    // City must be a real, selected municipality — CityAutocomplete only
    // ever WANTS one selected, but nothing stops someone from typing
    // something close-but-not-exact and submitting before picking a
    // suggestion. Caught here too (not just in the component's own inline
    // message) so it actually blocks the submit, and again server-side in
    // /api/register — belt and suspenders, same reasoning as the email-
    // confirm check above. Keyed off País (residence), not the phone's
    // dial code — those are separate now; only Colombia has a real
    // municipality list to validate against; see the city field's own
    // conditional render above.
    if (country === "CO" && byKey(questions, "city") && payload.city.trim() && !isKnownCityLabel(payload.city)) {
      setErrorMessage("Elige tu ciudad de la lista de sugerencias — revisa el campo Ciudad.");
      return;
    }

    onSubmitPayload(payload);
  }

  const fullName = byKey(questions, "fullName");
  const email = byKey(questions, "email");
  const phone = byKey(questions, "phone");
  const cedula = byKey(questions, "cedula");
  const city = byKey(questions, "city");
  const profession = byKey(questions, "profession");
  const customQuestions = questions.filter((q) => !q.locked);

  return (
    <form onSubmit={handleSubmit}>
      {/* Honeypot — invisible to a real person (off-canvas via absolute
          positioning, not display:none/visibility:hidden, since some bots
          specifically skip those two and still fill in a field that just
          LOOKS present in the DOM), but a plain empty text input to
          anything scripting the form. tabIndex=-1 keeps it out of
          keyboard tab order, aria-hidden keeps screen readers from ever
          announcing it, autoComplete="off" plus a name a form-filler
          extension might still target on its own. Checked server-side in
          /api/register — a non-empty value here never touches the DB. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
      />
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Tus datos</h2>
      <p style={{ fontSize: 12, color: "var(--danger)", marginTop: 0, marginBottom: 16 }}>* Campos obligatorios</p>

      {fullName &&
        (fullName.nameFormat === "FIRST_LAST" ? (
          <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
            <legend style={{ padding: 0, marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>
              {fullName.label}
            </legend>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="field_firstName">
                  Nombre
                  <Req required />
                </label>
                <input id="field_firstName" name="field_firstName" autoComplete="given-name" required />
              </div>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="field_lastName">Apellido</label>
                <input id="field_lastName" name="field_lastName" autoComplete="family-name" />
              </div>
            </div>
          </fieldset>
        ) : (
          <div className="field">
            <label htmlFor="field_fullName">
              {fullName.label}
              <Req required />
            </label>
            <input id="field_fullName" name="field_fullName" autoComplete="name" required />
          </div>
        ))}

      {email && (
        <div className="field">
          <label htmlFor="field_email">
            {email.label}
            <Req required />
          </label>
          <input
            id="field_email"
            name="field_email"
            type="email"
            autoComplete="email"
            required
            ref={emailInputRef}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
          />
          {emailSuggestion && (
            <p style={{ fontSize: 12, color: "#8a6d3b", margin: "4px 0 0" }}>
              ¿Quisiste decir{" "}
              <button
                type="button"
                onClick={applyEmailSuggestion}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  font: "inherit",
                  fontWeight: 600,
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {emailSuggestion}
              </button>
              ?
            </p>
          )}
          {/* One-line disclosure at the exact point the email is captured —
              see /api/register/draft's own comment (this is also where the
              abandoned-cart draft row gets created) and lib/abandonedCart.ts.
              Small and factual, not a consent checkbox: it just tells the
              person up front that not finishing means a reminder, instead
              of that being a surprise later. */}
          <p style={{ fontSize: 11, color: "#8a8f9c", margin: "4px 0 0" }}>
            Guardamos tu progreso — si no terminas, te recordamos por correo.
          </p>
        </div>
      )}

      {/* "no tiene sentido ahí tener el +57, es lo del celular. Ahí es
          [s]eleccionar el país, lo del celular es aparte" — Este es el
          país DONDE VIVE (Person.country — un campo real, obligatorio,
          filtrable en Personas y Segmentos, ver ese modelo), NO el
          código de marcado del celular (eso vive en su propio selector,
          justo abajo). "Tienes que tener todos los países del mundo" —
          la lista completa (lib/worldCountries.ts), no un puñado.
          Colombia preseleccionado — es efectivamente toda la audiencia
          hoy, pero Cúcuta ya trae tráfico real de Venezuela también. */}
      <div className="field">
        <label htmlFor="field_country">
          País<Req required />
        </label>
        <select id="field_country" required value={country} onChange={(e) => setCountry(e.target.value)}>
          {WORLD_COUNTRIES.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* El celular tiene su PROPIO selector de país — independiente del
          "País" de arriba ("puedo estar viviendo en Venezuela, pero
          tener mi celular de Estados Unidos... solo que facilitamos el
          hecho que ya está preseleccionado Venezuela"). El useEffect más
          arriba lo pre-llena cuando cambia País, pero queda libre de
          cambiarse aparte — no es una insignia fija, es un <select> real
          con la misma lista completa de países. */}
      {phone && (
        <div className="field">
          <label htmlFor="phone">
            {phone.label}
            <Req required={phone.required} />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              aria-label="País del celular"
              value={phoneCountryIso2}
              onChange={(e) => setPhoneCountryIso2(e.target.value)}
              // Wide enough for most "Nombre (+dialCode)" pairs without
              // truncating — a handful of the longest country names
              // still clip in the closed state, but the full text always
              // shows in the open dropdown itself.
              style={{ flex: "0 0 auto", width: 168 }}
            >
              {WORLD_COUNTRIES.map((c) => (
                <option key={c.iso2} value={c.iso2}>
                  {c.name} ({c.dialCode})
                </option>
              ))}
            </select>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              placeholder={phonePlaceholder}
              required={phone.required}
              style={{ flex: 1, minWidth: 0 }}
            />
          </div>
        </div>
      )}

      {email?.confirmEmail && (
        <div className="field">
          <label htmlFor="field_emailConfirm">
            Confirma tu correo electrónico
            <Req required />
          </label>
          <input id="field_emailConfirm" name="field_emailConfirm" type="email" autoComplete="email" required />
        </div>
      )}

      {(cedula || city) && (
        <Row>
          {cedula && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="field_cedula">
                {cedula.label}
                <Req required={cedula.required} />
              </label>
              <input id="field_cedula" name="field_cedula" required={cedula.required} placeholder={idPlaceholder} />
            </div>
          )}
          {city && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="field_city">
                {city.label}
                <Req required={city.required} />
              </label>
              {country === "CO" ? (
                <CityAutocomplete id="field_city" name="field_city" required={city.required} />
              ) : (
                // Outside Colombia there's no reliable municipality list to
                // validate against — free text instead of forcing a match
                // against a list that was never built for this country.
                // Keyed off País (residence), not the phone's dial code.
                <input id="field_city" name="field_city" required={city.required} placeholder="Tu ciudad" />
              )}
            </div>
          )}
        </Row>
      )}

      {profession && (
        <fieldset style={{ border: "none", padding: 0, margin: "16px 0" }}>
          <legend style={{ padding: 0, marginBottom: 8 }}>
            {profession.label}
            <Req required={profession.required} />
          </legend>
          {professionOptions.map((opt, i) => (
            <label
              key={opt}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}
            >
              <input type="radio" name="field_profession" value={opt} required={profession.required && i === 0} />
              <span>{opt}</span>
            </label>
          ))}
        </fieldset>
      )}

      {customQuestions.map((q) => {
        if (q.type === "RADIO") {
          return (
            <fieldset key={q.key} style={{ border: "none", padding: 0, margin: "16px 0" }}>
              <legend style={{ padding: 0, marginBottom: 8 }}>
                {q.label}
                <Req required={q.required} />
              </legend>
              {q.options.map((opt, i) => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                  <input type="radio" name={`field_${q.key}`} value={opt} required={q.required && i === 0} />
                  <span>{opt}</span>
                </label>
              ))}
            </fieldset>
          );
        }
        if (q.type === "CHECKBOX") {
          // No native `required` here — HTML can't express "at least one
          // of this group" per-checkbox; missing-required-fields is
          // caught server-side (see /api/register) and shown as an error.
          return (
            <fieldset key={q.key} style={{ border: "none", padding: 0, margin: "16px 0" }}>
              <legend style={{ padding: 0, marginBottom: 8 }}>
                {q.label}
                <Req required={q.required} />
              </legend>
              {q.options.map((opt) => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                  <input type="checkbox" name={`field_${q.key}`} value={opt} />
                  <span>{opt}</span>
                </label>
              ))}
            </fieldset>
          );
        }
        if (q.type === "SELECT") {
          return (
            <div className="field" key={q.key}>
              <label htmlFor={`field_${q.key}`}>
                {q.label}
                <Req required={q.required} />
              </label>
              <select id={`field_${q.key}`} name={`field_${q.key}`} required={q.required} defaultValue="">
                <option value="" disabled>
                  Selecciona una opción
                </option>
                {q.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (q.type === "DATE") {
          return (
            <div className="field" key={q.key}>
              <label htmlFor={`field_${q.key}`}>
                {q.label}
                <Req required={q.required} />
              </label>
              <input id={`field_${q.key}`} name={`field_${q.key}`} type="date" required={q.required} />
            </div>
          );
        }
        if (q.type === "AGREEMENT") {
          return (
            <label className="consent" key={q.key}>
              <input type="checkbox" name={`field_${q.key}`} required={q.required} />
              <span>
                {q.label}
                <Req required={q.required} />
              </span>
            </label>
          );
        }
        return (
          <div className="field" key={q.key}>
            <label htmlFor={`field_${q.key}`}>
              {q.label}
              <Req required={q.required} />
            </label>
            <input id={`field_${q.key}`} name={`field_${q.key}`} required={q.required} />
          </div>
        );
      })}

      {errorMessage && <p style={{ color: "#c2185b" }}>{errorMessage}</p>}

      {/* Botón antes del texto legal, no después — "quiero que el botón
          sea antes del texto... y más visible" — lo primero que se ve al
          terminar de llenar el formulario es la acción real, no un
          párrafo de letra pequeña. Un poco más grande/con sombra que el
          .primary por defecto (no se tocó la clase global — otros
          botones .primary en el resto del admin no deben cambiar) para
          que de verdad se note más que antes. */}
      <button
        className="primary"
        type="submit"
        disabled={submitting}
        style={{ fontSize: 16, padding: "16px 20px", boxShadow: "0 4px 14px rgba(0,190,181,0.35)" }}
      >
        {submitting ? "Enviando…" : submitLabel}
      </button>

      {/* Ningún checkbox de consentimiento ya — ni logística, ni
          marketing/publicidad, ni WhatsApp. Todo queda implícito en la
          propia acción de enviar el formulario, cubierto por esta misma
          línea (que menciona explícitamente la autorización de
          marketing/publicidad/WhatsApp, no solo "términos" en abstracto —
          ese texto también debe reflejarse en el contenido real de
          /terminos y /privacidad que se edita desde el admin). Sigue
          enviando cuatro consentimientos distintos al servidor (ver
          handleSubmit) — solo cambió la UI, no el modelo de datos. */}
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 12, marginBottom: 0 }}>
        Al hacer clic en &ldquo;{submitLabel}&rdquo; aceptas nuestros{" "}
        <a href="/terminos" target="_blank" rel="noreferrer">
          términos y condiciones
        </a>{" "}
        y nuestra{" "}
        <a href="/privacidad" target="_blank" rel="noreferrer">
          política de privacidad
        </a>
        ; autorizas el tratamiento de tus datos para enviarte tu entrada y la información operativa
        de este evento (incluyendo por WhatsApp al número que registraste); y autorizas recibir
        novedades de futuros eventos de Nail Fest y que te mostremos publicidad relevante en Meta
        con tus datos (de forma cifrada).
      </p>
    </form>
  );
}

// Two fields side by side instead of stacked full-width — real estate
// this form only has to spare now that Detalles has the modal's full
// width to itself (see EventRegistration.tsx).
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
      {children}
    </div>
  );
}
