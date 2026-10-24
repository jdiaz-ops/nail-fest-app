"use client";

import { useState, type FormEvent } from "react";
import type { LibraryLeadKindKey } from "@/lib/library/leads";

const SUBMIT: Record<LibraryLeadKindKey, string> = {
  REGISTRO: "Registrarme gratis",
  POSTULACION: "Enviar mi postulación",
  MARCA: "Enviar",
  CLASE: "Reservar",
};

const MESSAGE_LABEL: Partial<Record<LibraryLeadKindKey, string>> = {
  POSTULACION: "¿Qué enseñas? Cuéntanos tu experiencia",
  MARCA: "¿Qué necesitas?",
  CLASE: "¿Alguna pregunta? (opcional)",
};

type Status = "idle" | "sending" | "invalid" | "error" | "done";

// The library's and the instructors' forms: the free sign-up (which opens
// the recordings and the step by steps right away, on this browser), an
// instructor's application, a brand looking for instructors and a class
// booking. Everything lands in Editar biblioteca → Registros; nobody is
// emailed or WhatsApped automatically.
export default function LeadForm({
  kind,
  instructor,
  context,
  returnTo,
  thanksText,
  sample,
}: {
  kind: LibraryLeadKindKey;
  instructor: { slug: string; name: string } | null;
  context: string | null;
  /** After the free sign-up: back to the video that asked for it. */
  returnTo: string | null;
  thanksText: string;
  /** An invented instructor (staff preview): nothing is saved. */
  sample: boolean;
}) {
  const [status, setStatus] = useState<Status>("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "").trim() || null;
    setStatus("sending");
    try {
      const res = await fetch("/api/library/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          name: text("name") ?? "",
          email: text("email") ?? "",
          phone: text("phone"),
          city: text("city"),
          company: text("company"),
          message: text("message"),
          instructor: instructor?.slug ?? null,
          context,
          marketingConsent: form.get("marketing") === "on",
          website: String(form.get("website") ?? ""),
        }),
      });
      if (res.status === 400) {
        setStatus("invalid");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      if (kind === "REGISTRO" && returnTo) {
        // A full load, so the page reads the new sign-up cookie.
        window.location.assign(returnTo);
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="bib-thanks" role="status">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        <p>{sample ? "Ejemplo: con una instructora real, esto quedaría en Editar biblioteca → Registros." : thanksText}</p>
      </div>
    );
  }

  const needsPhone = kind !== "REGISTRO";
  return (
    <form className="bib-form" onSubmit={submit} noValidate={false}>
      {instructor && (
        <p className="bib-form-about">
          Con <b>{instructor.name}</b>
          {context ? ` · ${context}` : ""}
        </p>
      )}
      <div className="field">
        <label htmlFor="lead-name">Nombre y apellido</label>
        <input id="lead-name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="lead-email">Correo</label>
        <input id="lead-email" name="email" type="email" required maxLength={200} autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="lead-phone">WhatsApp{needsPhone ? "" : " (opcional)"}</label>
        <input id="lead-phone" name="phone" type="tel" required={needsPhone} maxLength={40} autoComplete="tel" />
      </div>
      {kind === "MARCA" && (
        <div className="field">
          <label htmlFor="lead-company">Marca</label>
          <input id="lead-company" name="company" required maxLength={120} autoComplete="organization" />
        </div>
      )}
      {kind !== "CLASE" && (
        <div className="field">
          <label htmlFor="lead-city">Ciudad{kind === "POSTULACION" ? "" : " (opcional)"}</label>
          <input id="lead-city" name="city" required={kind === "POSTULACION"} maxLength={80} autoComplete="address-level2" />
        </div>
      )}
      {MESSAGE_LABEL[kind] && (
        <div className="field">
          <label htmlFor="lead-message">{MESSAGE_LABEL[kind]}</label>
          <textarea id="lead-message" name="message" rows={4} maxLength={1500} required={kind === "POSTULACION"} />
        </div>
      )}
      {/* Nobody sees this box; a bot fills it in. */}
      <div className="bib-hp" aria-hidden="true">
        <label htmlFor="lead-website">No llenar</label>
        <input id="lead-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="bib-check">
        <input type="checkbox" name="marketing" />
        <span>Quiero recibir novedades de Nail Fest: videos nuevos, clases y descuentos. Me puedo dar de baja cuando quiera.</span>
      </label>
      <p className="bib-form-legal">
        Al enviar, autorizas a Nail Fest a usar estos datos para responderte, según su <a href="/privacidad">política de privacidad</a>.
      </p>
      {status === "invalid" && <p className="bib-form-error">Revisa tus datos: falta algo o hay un correo mal escrito.</p>}
      {status === "error" && <p className="bib-form-error">No se pudo enviar. Vuelve a intentarlo en un momento.</p>}
      <button type="submit" className="bib-btn bib-btn-dark" disabled={status === "sending"}>
        {status === "sending" ? "Enviando…" : SUBMIT[kind]}
      </button>
    </form>
  );
}
