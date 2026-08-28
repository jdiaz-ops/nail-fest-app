"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { attributionFromSearchParams } from "@/lib/utm";
import { track } from "./tracking";

interface Props {
  eventSlug: string;
  professionOptions: string[];
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export default function RegistrationForm({ eventSlug, professionOptions }: Props) {
  const searchParams = useSearchParams();
  const firedCheckoutStart = useRef(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    const payload = {
      eventSlug,
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? "") || undefined,
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      city: String(form.get("city") ?? ""),
      profession: String(form.get("profession") ?? "") || undefined,
      customFields: {},
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
      <div className="field">
        <label htmlFor="firstName">Nombre</label>
        <input id="firstName" name="firstName" required />
      </div>
      <div className="field">
        <label htmlFor="lastName">Apellido</label>
        <input id="lastName" name="lastName" required />
      </div>
      <div className="field">
        <label htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" required />
      </div>
      <div className="field">
        <label htmlFor="phone">Teléfono (opcional)</label>
        <input id="phone" name="phone" type="tel" placeholder="+57..." />
      </div>
      <div className="field">
        <label htmlFor="city">Ciudad</label>
        <input id="city" name="city" required />
      </div>
      <div className="field">
        <label htmlFor="profession">¿A qué te dedicas?</label>
        <select id="profession" name="profession" defaultValue="">
          <option value="" disabled>
            Selecciona una opción
          </option>
          {professionOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
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
