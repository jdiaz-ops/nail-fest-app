"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { attributionFromSearchParams } from "@/lib/utm";
import { track } from "./tracking";

interface Props {
  eventSlug: string;
  professionOptions: string[];
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

export default function RegistrationForm({ eventSlug, professionOptions }: Props) {
  const searchParams = useSearchParams();
  const firedCheckoutStart = useRef(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("+57");

  useEffect(() => {
    // This single page serves as both "landing" and "ticket page" for
    // Slice 1 — PageView and ViewContent both fire on mount. Once the
    // landing gets its own step ahead of the form, split these.
    track("PageView");
    track("ViewContent");
  }, []);

  function markCheckoutStarted() {
    if (firedCheckoutStart.current) return;
    firedCheckoutStart.current = true;
    track("InitiateCheckout");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const form = new FormData(e.currentTarget);
    const localPhone = String(form.get("phone") ?? "").replace(/[^0-9]/g, "");
    const instagram = String(form.get("instagram") ?? "").trim();
    const payload = {
      eventSlug,
      email: String(form.get("email") ?? ""),
      phone: localPhone ? `${countryCode}${localPhone}` : "",
      fullName: String(form.get("fullName") ?? ""),
      city: String(form.get("city") ?? ""),
      profession: String(form.get("profession") ?? ""),
      cedula: String(form.get("cedula") ?? ""),
      instagram: instagram || undefined,
      consents: {
        logistics: form.get("consentLogistics") === "on",
        marketing: form.get("consentMarketing") === "on",
        advertising: form.get("consentAdvertising") === "on",
      },
      attribution: attributionFromSearchParams(searchParams),
      fbc: readCookie("_fbc"),
      fbp: readCookie("_fbp"),
    };

    if (!payload.consents.logistics) {
      setStatus("error");
      setErrorMessage("Necesitamos tu autorización para enviarte la entrada por correo.");
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setStatus("done");
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setErrorMessage(body?.error === "event_not_found" ? "Este evento ya no está disponible." : "Algo salió mal, intenta de nuevo.");
    }
  }

  if (status === "done") {
    return (
      <div>
        <h2>¡Listo!</h2>
        <p>Revisa tu correo — ahí va tu entrada con el código QR.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onFocus={markCheckoutStarted}>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Tus datos</h2>

      <div className="field">
        <label htmlFor="fullName">Nombre y Apellido - o - Razón Social</label>
        <input id="fullName" name="fullName" required />
      </div>

      <div className="field">
        <label htmlFor="email">
          Correo Electrónico (Importante: verifica que esté correcto; ahí enviaremos tu entrada)
        </label>
        <input id="email" name="email" type="email" required />
      </div>

      <div className="field">
        <label htmlFor="phone">
          Número de celular con WhatsApp - (asegúrate que sea correcto para recibir info del
          evento)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            aria-label="Código de país"
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            style={{ flex: "0 0 auto" }}
          >
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input id="phone" name="phone" type="tel" placeholder="321 1234567" required style={{ flex: 1 }} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="cedula">Número de cédula - o - NIT</label>
        <input id="cedula" name="cedula" required />
      </div>

      <div className="field">
        <label htmlFor="city">¿En que ciudad vives?</label>
        <input id="city" name="city" required />
      </div>

      <fieldset style={{ border: "none", padding: 0, margin: "16px 0" }}>
        <legend style={{ padding: 0, marginBottom: 8 }}>
          ¿Cuál de estas opciones te describe mejor? (Selecciona una sola)
        </legend>
        {professionOptions.map((opt, i) => (
          <label
            key={opt}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}
          >
            <input type="radio" name="profession" value={opt} required={i === 0} />
            <span>{opt}</span>
          </label>
        ))}
      </fieldset>

      <div className="field">
        <label htmlFor="instagram">Déjanos tu @ Instagram/Tiktok (Opcional)</label>
        <input id="instagram" name="instagram" placeholder="@tuusuario" />
      </div>

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

      {errorMessage && <p style={{ color: "#c2185b" }}>{errorMessage}</p>}

      <button className="primary" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Enviando..." : "Confirmar mi registro"}
      </button>
    </form>
  );
}
