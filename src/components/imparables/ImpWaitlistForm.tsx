"use client";

import { useState } from "react";
import PhoneCountryPicker from "@/components/PhoneCountryPicker";
import { getValidFbc } from "@/components/tracking";
import { COUNTRY_CODES, GENERIC_PHONE_PLACEHOLDER, stripTrunkZero } from "@/lib/countryCodes";
import { suggestEmailCorrection } from "@/lib/emailTypo";
import { WORLD_COUNTRIES, findCountry } from "@/lib/worldCountries";

// The waiting list on Manicuristas Imparables' page, before its first
// price stage opens: name, WhatsApp, email, city and country. Each person
// lands in the CRM with the event's «Lista de espera» label
// (/api/lista-de-espera) so the team can tell them, first, when the sale
// opens — nothing is sent from here. Meta gets a Lead, the Pixel's and the
// server's sharing one event id.

const COUNTRY_OPTIONS = [
  ...["CO", "VE"].map((iso2) => findCountry(iso2)!),
  ...[...WORLD_COUNTRIES].filter((c) => c.iso2 !== "CO" && c.iso2 !== "VE").sort((a, b) => a.name.localeCompare(b.name, "es")),
];

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

const ERRORS: Record<string, string> = {
  email_domain_invalid: "Ese correo no parece existir: revisa lo que va después de la @.",
  not_permitted: "No podemos anotar este correo.",
  event_not_found: "Esta lista de espera ya no está abierta.",
  invalid_body: "Revisa los datos: falta alguno o no está bien escrito.",
};

export default function ImpWaitlistForm({ eventSlug, intro }: { eventSlug: string; intro: React.ReactNode }) {
  const [phoneIso2, setPhoneIso2] = useState("CO");
  const [countryIso2, setCountryIso2] = useState("CO");
  const [countryTouched, setCountryTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const phoneHint = COUNTRY_CODES.find((c) => c.iso2 === phoneIso2);

  function pickPhoneCountry(iso2: string) {
    setPhoneIso2(iso2);
    // Where she lives usually follows her number's country, until she says otherwise.
    if (!countryTouched) setCountryIso2(iso2);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const digits = String(form.get("phone") ?? "").replace(/\D/g, "");
    const dialCode = (findCountry(phoneIso2) ?? WORLD_COUNTRIES[0]!).dialCode;
    const leadEventId = crypto.randomUUID();
    setSending(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/lista-de-espera", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug,
          fullName: String(form.get("fullName") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          phone: digits ? `${dialCode}${stripTrunkZero(digits)}` : "",
          city: String(form.get("city") ?? "").trim(),
          country: countryIso2,
          website: String(form.get("website") ?? ""),
          fbc: getValidFbc(),
          fbp: readCookie("_fbp"),
          leadEventId,
          sourceUrl: window.location.href,
        }),
      });
    } catch {
      setSending(false);
      setError("No pudimos anotarte. Revisa tu conexión e intenta de nuevo.");
      return;
    }
    setSending(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(ERRORS[body?.error as string] ?? "Algo salió mal, intenta de nuevo.");
      return;
    }
    setDone(body?.firstName || "");
    window.clarity?.("event", "lista_de_espera");
    try {
      window.fbq?.("track", "Lead", {}, { eventID: leadEventId });
    } catch {
      // The server already sent Meta this same Lead; a broken pixel never undoes her sign-up.
    }
  }

  if (done !== null) {
    return (
      <div className="imp-wl imp-wl--done" id="lista-de-espera" role="status">
        <span className="imp-wl-check" aria-hidden="true">
          ✓
        </span>
        <h3>{done ? `¡Listo, ${done}!` : "¡Listo!"} Quedaste en la lista.</h3>
        <p>Te escribimos por WhatsApp y por correo apenas abra la venta, antes que a nadie.</p>
      </div>
    );
  }

  return (
    <form className="imp-wl" id="lista-de-espera" onSubmit={submit}>
      <h3>Entra a la lista de espera</h3>
      <p className="imp-wl-intro">{intro}</p>
      <label className="imp-fld">
        <span>Nombre</span>
        <input name="fullName" autoComplete="name" required maxLength={120} placeholder="Tu nombre y apellido" />
      </label>
      <div className="imp-fld">
        <label htmlFor="imp-wl-phone">WhatsApp</label>
        <div className="imp-fld-phone">
          <PhoneCountryPicker value={phoneIso2} onChange={pickPhoneCountry} />
          <input id="imp-wl-phone" name="phone" type="tel" autoComplete="tel" required placeholder={phoneHint?.phonePlaceholder ?? GENERIC_PHONE_PLACEHOLDER} />
        </div>
      </div>
      <label className="imp-fld">
        <span>Correo</span>
        <input name="email" type="email" autoComplete="email" required maxLength={200} placeholder="tucorreo@ejemplo.com" onChange={(e) => setEmailSuggestion(suggestEmailCorrection(e.currentTarget.value))} />
      </label>
      {emailSuggestion && (
        <p className="imp-wl-hint">
          ¿Quisiste decir{" "}
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget.form?.elements.namedItem("email") as HTMLInputElement | null;
              if (input) input.value = emailSuggestion;
              setEmailSuggestion(null);
            }}
          >
            {emailSuggestion}
          </button>
          ?
        </p>
      )}
      <div className="imp-two">
        <label className="imp-fld">
          <span>Ciudad</span>
          <input name="city" autoComplete="address-level2" required maxLength={80} placeholder="Tu ciudad" />
        </label>
        <label className="imp-fld">
          <span>País</span>
          <select
            name="country"
            value={countryIso2}
            onChange={(e) => {
              setCountryTouched(true);
              setCountryIso2(e.target.value);
            }}
          >
            {COUNTRY_OPTIONS.map((c, i) => (
              <option key={`${c.iso2}-${i}`} value={c.iso2}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Honeypot: empty from a person, filled by a script that fills every field. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="imp-hp" />
      <button type="submit" className="imp-cta" disabled={sending}>
        {sending ? "Anotándote…" : "Quiero estar en la lista"}
      </button>
      {error && (
        <p className="imp-wl-error" role="alert">
          {error}
        </p>
      )}
      <small>Te avisamos por WhatsApp y por correo apenas abra la venta. Puedes salirte cuando quieras.</small>
      <small className="imp-wl-legal">
        Al tocar «Quiero estar en la lista» aceptas los{" "}
        <a href="/terminos" target="_blank" rel="noreferrer">
          términos y condiciones
        </a>{" "}
        y la{" "}
        <a href="/privacidad" target="_blank" rel="noreferrer">
          política de privacidad
        </a>
        , y autorizas que Nail Fest te escriba por correo y WhatsApp sobre este congreso y sus próximos eventos, y te muestre publicidad en Meta con
        tus datos cifrados.
      </small>
    </form>
  );
}
