"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PASSWORD_FROM, normalizeUsername, usernameProblem } from "@/lib/library/portal";
import { PasswordInput, send } from "./fields";
import { PortalIcon } from "./icons";

type Check = { state: "idle" | "checking" | "ok" | "bad"; message: string | null };

// "Crea tu cuenta" (/instructoras/unirme/cuenta): her username — checked
// while she types, it's her profile's address — her email, her WhatsApp
// for the team and a password. Then on to the onboarding.
export default function SignupForm() {
  const [username, setUsername] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle", message: null });
  const [error, setError] = useState<{ message: string; fields: string[] } | null>(null);
  const [sending, setSending] = useState(false);
  const normalized = normalizeUsername(username);

  useEffect(() => {
    if (!normalized) {
      setCheck({ state: "idle", message: null });
      return;
    }
    setCheck({ state: "checking", message: null });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const problem = usernameProblem(normalized);
      if (problem) {
        setCheck({ state: "bad", message: problem });
        return;
      }
      try {
        const res = await fetch(`/api/instructoras/usuario?u=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const data = (await res.json()) as { available?: boolean; message?: string | null };
        setCheck(data.available ? { state: "ok", message: null } : { state: "bad", message: data.message ?? "Ese usuario no está disponible." });
      } catch {
        // Typed on, or offline: the sign-up checks it again.
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [normalized]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    const result = await send("/api/instructoras/registro", {
      username: normalized,
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      password: String(form.get("password") ?? ""),
      acceptTerms: form.get("acceptTerms") === "on",
      website: String(form.get("website") ?? ""),
    });
    if (result.ok) {
      // A full load: the next page reads her new session.
      window.location.assign(typeof result.data.next === "string" ? result.data.next : "/instructoras/portal");
      return;
    }
    setSending(false);
    setError({ message: result.message ?? "Revisa los datos.", fields: result.fields });
  }

  const bad = (field: string) => Boolean(error?.fields.includes(field)) || undefined;
  return (
    <form className="pt-card" onSubmit={submit}>
      <div className="field">
        <label htmlFor="su-user">Usuario</label>
        <div className="pt-inputbox">
          <input
            id="su-user"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
            maxLength={40}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={check.state === "bad" || bad("username")}
            aria-describedby="su-user-hint"
          />
          {check.state === "ok" && (
            <span className="pt-ok">
              <PortalIcon name="check" size={14} /> Disponible
            </span>
          )}
          {check.state === "checking" && <span className="pt-hint">Revisando…</span>}
        </div>
        <span id="su-user-hint" className={check.state === "bad" ? "pt-bad" : "pt-hint"}>
          {check.state === "bad" ? (
            check.message
          ) : (
            <>
              Será tu dirección: <b>nailfest.lat/instructoras/{normalized || "tuusuario"}</b>
            </>
          )}
        </span>
      </div>
      <div className="field">
        <label htmlFor="su-email">Correo</label>
        <input id="su-email" name="email" type="email" required maxLength={160} autoComplete="email" aria-invalid={bad("email")} aria-describedby="su-email-hint" />
        <span id="su-email-hint" className="pt-hint">
          Para entrar a tu cuenta. No se publica.
        </span>
      </div>
      <div className="field">
        <label htmlFor="su-phone">Celular (WhatsApp)</label>
        <input id="su-phone" name="phone" type="tel" required maxLength={40} autoComplete="tel" aria-invalid={bad("phone")} aria-describedby="su-phone-hint" />
        <span id="su-phone-hint" className="pt-hint">
          Para que el equipo te escriba sobre tu perfil. No se publica.
        </span>
      </div>
      <div className="field">
        <label htmlFor="su-password">Contraseña</label>
        <PasswordInput id="su-password" autoComplete="new-password" minLength={PASSWORD_FROM} invalid={bad("password")} describedBy="su-password-hint" />
        <span id="su-password-hint" className="pt-hint">
          Mínimo {PASSWORD_FROM} caracteres.
        </span>
      </div>
      {/* Nobody sees this box; a bot fills it in. */}
      <div className="bib-hp" aria-hidden="true">
        <label htmlFor="su-website">No llenar</label>
        <input id="su-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="bib-check">
        <input type="checkbox" name="acceptTerms" required />
        <span>
          Doy clases de uñas y acepto los{" "}
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
      {error && (
        <p className="pt-error" role="alert">
          {error.message}
        </p>
      )}
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
        {sending ? "Creando tu cuenta…" : "Crear mi cuenta"}
      </button>
    </form>
  );
}
