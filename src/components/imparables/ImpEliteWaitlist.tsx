"use client";

import { useState } from "react";
import PhoneCountryPicker from "@/components/PhoneCountryPicker";
import { COUNTRY_CODES, GENERIC_PHONE_PLACEHOLDER, stripTrunkZero } from "@/lib/countryCodes";
import { WORLD_COUNTRIES, findCountry } from "@/lib/worldCountries";

// «Avísame si se abre un cupo» on Élite's card once its 20 are paid
// (lib/imparables/tiers.ts, 2026-10-31): her email and WhatsApp, on Élite's
// own list in the CRM (/api/lista-de-espera, list "elite") — nothing is sent
// from here; the team writes first if a place frees up.
export default function ImpEliteWaitlist({ eventSlug, intro, button, done }: { eventSlug: string; intro: string; button: string; done: string }) {
  const [phoneIso2, setPhoneIso2] = useState("CO");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const phoneHint = COUNTRY_CODES.find((c) => c.iso2 === phoneIso2);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const digits = String(form.get("phone") ?? "").replace(/\D/g, "");
    const dialCode = (findCountry(phoneIso2) ?? WORLD_COUNTRIES[0]!).dialCode;
    setSending(true);
    setError(null);
    const res = await fetch("/api/lista-de-espera", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventSlug,
        list: "elite",
        email: String(form.get("email") ?? "").trim(),
        phone: digits ? `${dialCode}${stripTrunkZero(digits)}` : "",
        country: phoneIso2,
        website: String(form.get("website") ?? ""),
        sourceUrl: window.location.href,
      }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) {
      setError(res ? "Revisa tu correo y tu WhatsApp: falta alguno o no está bien escrito." : "No pudimos anotarte. Revisa tu conexión e intenta de nuevo.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="imp-lv-wl" role="status">
        <p>{done}</p>
      </div>
    );
  }
  return (
    <form className="imp-lv-wl" onSubmit={submit}>
      <p>{intro}</p>
      <label className="imp-fld">
        <span>Correo</span>
        <input name="email" type="email" autoComplete="email" required maxLength={200} placeholder="tucorreo@ejemplo.com" />
      </label>
      <div className="imp-fld">
        <label htmlFor="imp-lv-wl-phone">WhatsApp</label>
        <div className="imp-fld-phone">
          <PhoneCountryPicker value={phoneIso2} onChange={setPhoneIso2} />
          <input id="imp-lv-wl-phone" name="phone" type="tel" autoComplete="tel" required placeholder={phoneHint?.phonePlaceholder ?? GENERIC_PHONE_PLACEHOLDER} />
        </div>
      </div>
      {/* Honeypot: empty from a person, filled by a script that fills every field. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="imp-hp" />
      <button type="submit" className="imp-cta" disabled={sending}>
        {sending ? "Anotándote…" : button}
      </button>
      {error && (
        <p className="imp-lv-wl-err" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
