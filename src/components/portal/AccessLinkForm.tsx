"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PASSWORD_FROM } from "@/lib/library/portal";
import { PasswordInput, send } from "./fields";

// A link the team sent her by WhatsApp (/instructoras/clave/<token>):
// a new password for her account, or — for a profile the team made — her
// own account to look after it. Either way she ends up in her portal.
export default function AccessLinkForm({ token, invite }: { token: string; invite: boolean }) {
  const [error, setError] = useState<{ message: string; fields: string[] } | null>(null);
  const [spent, setSpent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    const result = await send("/api/instructoras/clave", {
      token,
      password: String(form.get("password") ?? ""),
      ...(invite ? { email: String(form.get("email") ?? ""), phone: String(form.get("phone") ?? ""), acceptTerms: form.get("acceptTerms") === "on" } : {}),
    });
    if (result.ok) {
      window.location.assign(typeof result.data.next === "string" ? result.data.next : "/instructoras/portal");
      return;
    }
    setSending(false);
    if (result.data.error === "expired") setSpent(result.message);
    else setError({ message: result.message ?? "Revisa los datos.", fields: result.fields });
  }

  if (spent) {
    return (
      <div className="pt-card" role="alert">
        <p>{spent}</p>
        <Link href="/instructoras/entrar" className="bib-btn bib-btn-line bib-btn-sm">
          Ir a entrar
        </Link>
      </div>
    );
  }

  const bad = (field: string) => Boolean(error?.fields.includes(field)) || undefined;
  return (
    <form className="pt-card" onSubmit={submit}>
      {invite && (
        <>
          <div className="field">
            <label htmlFor="ak-email">Correo</label>
            <input id="ak-email" name="email" type="email" required maxLength={160} autoComplete="email" aria-invalid={bad("email")} aria-describedby="ak-email-hint" />
            <span id="ak-email-hint" className="pt-hint">
              Para entrar a tu cuenta. No se publica.
            </span>
          </div>
          <div className="field">
            <label htmlFor="ak-phone">Celular (WhatsApp)</label>
            <input id="ak-phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" aria-invalid={bad("phone")} aria-describedby="ak-phone-hint" />
            <span id="ak-phone-hint" className="pt-hint">
              Para que el equipo te escriba sobre tu perfil. No se publica.
            </span>
          </div>
        </>
      )}
      <div className="field">
        <label htmlFor="ak-password">{invite ? "Crea tu contraseña" : "Contraseña nueva"}</label>
        <PasswordInput id="ak-password" autoComplete="new-password" minLength={PASSWORD_FROM} invalid={bad("password")} describedBy="ak-password-hint" />
        <span id="ak-password-hint" className="pt-hint">
          Mínimo {PASSWORD_FROM} caracteres.
        </span>
      </div>
      {invite && (
        <label className="bib-check">
          <input type="checkbox" name="acceptTerms" required />
          <span>
            Acepto los{" "}
            <Link href="/instructoras/terminos" target="_blank">
              términos del directorio
            </Link>{" "}
            y la{" "}
            <a href="/privacidad" target="_blank">
              política de privacidad
            </a>
            .
          </span>
        </label>
      )}
      {error && (
        <p className="pt-error" role="alert">
          {error.message}
        </p>
      )}
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
        {sending ? "Guardando…" : invite ? "Activar mi cuenta" : "Guardar y entrar"}
      </button>
    </form>
  );
}
