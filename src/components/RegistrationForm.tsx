"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { attributionFromSearchParams } from "@/lib/utm";

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
  customFields: Record<string, string>;
  consents: { logistics: boolean; marketing: boolean; advertising: boolean };
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

// Matches the Ticket Tailor forms this replaces — Colombia default since
// that's effectively the whole audience today (see docs/IMPORT.md), with a
// handful of other countries covered rather than forcing everyone else to
// mistype a Colombian number.
const COUNTRY_CODES = [
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

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function byKey(questions: QuestionView[], key: string): QuestionView | undefined {
  return questions.find((q) => q.key === key);
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
  const [countryCode, setCountryCode] = useState("+57");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage(null);

    const form = new FormData(e.currentTarget);
    const localPhone = String(form.get("phone") ?? "").replace(/[^0-9]/g, "");
    const advertisingConsent = form.get("consentAdvertising") === "on";
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
      phone: localPhone ? `${countryCode}${localPhone}` : "",
      // Only one of fullName or firstName/lastName is ever actually
      // populated below — sending both keys with one blank is fine,
      // /api/register only looks at firstName first, then falls back.
      fullName: usesFirstLast ? undefined : String(form.get("field_fullName") ?? ""),
      firstName: usesFirstLast ? String(form.get("field_firstName") ?? "").trim() : undefined,
      lastName: usesFirstLast ? String(form.get("field_lastName") ?? "").trim() : undefined,
      emailConfirm: emailQuestion?.confirmEmail ? String(form.get("field_emailConfirm") ?? "") : undefined,
      city: String(form.get("field_city") ?? ""),
      profession: String(form.get("field_profession") ?? ""),
      customFields,
      consents: {
        logistics: form.get("consentLogistics") === "on",
        marketing: form.get("consentMarketing") === "on",
        advertising: advertisingConsent,
      },
      attribution: attributionFromSearchParams(searchParams),
      fbc: readCookie("_fbc"),
      fbp: readCookie("_fbp"),
      ticketTypeId,
      ticketCount,
    };

    if (!payload.consents.logistics) {
      setErrorMessage("Necesitamos tu autorización para enviarte la entrada por correo.");
      return;
    }

    // Same typo-catching purpose as the second input itself — checked
    // client-side too so the person sees it immediately instead of a
    // round trip to the server.
    if (emailQuestion?.confirmEmail && payload.emailConfirm?.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setErrorMessage("Los correos no coinciden — revísalos.");
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
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Tus datos</h2>

      {fullName &&
        (fullName.nameFormat === "FIRST_LAST" ? (
          <fieldset style={{ border: "none", padding: 0, margin: "0 0 16px" }}>
            <legend style={{ padding: 0, marginBottom: 8, fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>
              {fullName.label}
            </legend>
            <div style={{ display: "flex", gap: 8 }}>
              <div className="field" style={{ flex: 1, marginBottom: 0 }}>
                <label htmlFor="field_firstName">Nombre</label>
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
            <label htmlFor="field_fullName">{fullName.label}</label>
            <input id="field_fullName" name="field_fullName" autoComplete="name" required />
          </div>
        ))}

      {/* Email + Phone side by side — Detalles has the full modal width to
          itself now (no order-summary sidebar stealing half of it), so a
          single narrow column of full-width fields would waste it. */}
      {(email || phone) && (
        <Row>
          {email && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="field_email">{email.label}</label>
              <input id="field_email" name="field_email" type="email" autoComplete="email" required />
            </div>
          )}
          {phone && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="phone">{phone.label}</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  aria-label="Código de país"
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  // .field select in globals.css sets width:100% — inside this
                  // flex row that becomes this select's flex-basis (flex-basis:
                  // auto defers to `width`), so it was eating almost the whole
                  // row and squeezing the number input into a sliver. A fixed
                  // width here overrides that instead of fighting the cascade.
                  style={{ flex: "0 0 auto", width: 112 }}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="321 1234567"
                  required={phone.required}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
            </div>
          )}
        </Row>
      )}

      {email?.confirmEmail && (
        <div className="field">
          <label htmlFor="field_emailConfirm">Confirma tu correo electrónico</label>
          <input id="field_emailConfirm" name="field_emailConfirm" type="email" autoComplete="email" required />
        </div>
      )}

      {(cedula || city) && (
        <Row>
          {cedula && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="field_cedula">{cedula.label}</label>
              <input id="field_cedula" name="field_cedula" required={cedula.required} />
            </div>
          )}
          {city && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="field_city">{city.label}</label>
              <input id="field_city" name="field_city" autoComplete="address-level2" required={city.required} />
            </div>
          )}
        </Row>
      )}

      {profession && (
        <fieldset style={{ border: "none", padding: 0, margin: "16px 0" }}>
          <legend style={{ padding: 0, marginBottom: 8 }}>{profession.label}</legend>
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
              <legend style={{ padding: 0, marginBottom: 8 }}>{q.label}</legend>
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
              <legend style={{ padding: 0, marginBottom: 8 }}>{q.label}</legend>
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
              <label htmlFor={`field_${q.key}`}>{q.label}</label>
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
              <label htmlFor={`field_${q.key}`}>{q.label}</label>
              <input id={`field_${q.key}`} name={`field_${q.key}`} type="date" required={q.required} />
            </div>
          );
        }
        if (q.type === "AGREEMENT") {
          return (
            <label className="consent" key={q.key}>
              <input type="checkbox" name={`field_${q.key}`} required={q.required} />
              <span>{q.label}</span>
            </label>
          );
        }
        return (
          <div className="field" key={q.key}>
            <label htmlFor={`field_${q.key}`}>{q.label}</label>
            <input id={`field_${q.key}`} name={`field_${q.key}`} required={q.required} />
          </div>
        );
      })}

      <label className="consent">
        <input type="checkbox" name="consentLogistics" required />
        <span>
          Autorizo el tratamiento de mis datos para enviarme mi entrada y la información operativa
          de este evento. (Requerido)
        </span>
      </label>
      <label className="consent">
        <input type="checkbox" name="consentMarketing" />
        <span>Quiero recibir novedades y futuros eventos de Nail Fest por correo.</span>
      </label>
      <label className="consent">
        <input type="checkbox" name="consentAdvertising" />
        <span>
          Autorizo compartir mis datos (de forma cifrada) con Meta para mostrarme publicidad
          relevante de Nail Fest.
        </span>
      </label>

      <p style={{ fontSize: 12, color: "#5b5f6b" }}>
        Al registrarte aceptas nuestra{" "}
        <a href="/privacidad" target="_blank" rel="noreferrer">
          política de privacidad
        </a>
        .
      </p>

      {errorMessage && <p style={{ color: "#c2185b" }}>{errorMessage}</p>}

      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? "Enviando…" : submitLabel}
      </button>
    </form>
  );
}

// Two fields side by side instead of stacked full-width — real estate
// this form only has to spare now that Detalles has the modal's full
// width to itself (see EventRegistration.tsx).
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>{children}</div>;
}
