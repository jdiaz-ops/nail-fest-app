"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PASSWORD_FROM } from "@/lib/library/portal";
import { PasswordInput, send } from "./fields";

type Status = { sending: boolean; done: string | null; message: string | null; fields: string[] };
const IDLE: Status = { sending: false, done: null, message: null, fields: [] };

// "Cuenta" in the portal: her username (fixed: it's her profile's
// address), her email and WhatsApp, her password, and the way out.
export default function AccountForm({ email, phone }: { email: string; phone: string }) {
  const router = useRouter();
  const [details, setDetails] = useState<Status>(IDLE);
  const [password, setPassword] = useState<Status>(IDLE);
  const [newEmail, setNewEmail] = useState(email);
  const emailChanged = newEmail.trim().toLowerCase() !== email;

  async function saveDetails(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setDetails({ ...IDLE, sending: true });
    const result = await send(
      "/api/instructoras/cuenta",
      { email: newEmail, phone: String(form.get("phone") ?? ""), ...(emailChanged ? { currentPassword: String(form.get("currentPassword") ?? "") } : {}) },
      "PATCH",
    );
    if (!result.ok) {
      setDetails({ ...IDLE, message: result.message, fields: result.fields });
      return;
    }
    setDetails({ ...IDLE, done: "Guardado." });
    router.refresh();
  }

  async function savePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setPassword({ ...IDLE, sending: true });
    const result = await send("/api/instructoras/cuenta", { currentPassword: String(form.get("currentPassword") ?? ""), newPassword: String(form.get("newPassword") ?? "") }, "PATCH");
    if (!result.ok) {
      setPassword({ ...IDLE, message: result.message, fields: result.fields });
      return;
    }
    formEl.reset();
    setPassword({ ...IDLE, done: "Listo: tu contraseña cambió." });
  }

  async function logout() {
    await send("/api/instructoras/salir");
    window.location.assign("/instructoras/entrar");
  }

  return (
    <>
      <form className="pt-card" onSubmit={saveDetails}>
        <h2 className="pt-h3">Tus datos</h2>
        <div className="field">
          <label htmlFor="ac-email">Correo</label>
          <input
            id="ac-email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            maxLength={160}
            autoComplete="email"
            aria-invalid={details.fields.includes("email") || undefined}
          />
        </div>
        <div className="field">
          <label htmlFor="ac-phone">Celular (WhatsApp)</label>
          <input id="ac-phone" name="phone" type="tel" defaultValue={phone} required maxLength={40} autoComplete="tel" aria-invalid={details.fields.includes("phone") || undefined} />
          <span className="pt-hint">No se publican: son para entrar y para que el equipo te escriba.</span>
        </div>
        {emailChanged && (
          <div className="field">
            <label htmlFor="ac-current-1">Tu contraseña actual</label>
            <PasswordInput id="ac-current-1" name="currentPassword" autoComplete="current-password" invalid={details.fields.includes("currentPassword")} />
            <span className="pt-hint">Para cambiar el correo te la pedimos.</span>
          </div>
        )}
        {details.message && (
          <p className="pt-error" role="alert">
            {details.message}
          </p>
        )}
        {details.done && (
          <p className="pt-saved" role="status">
            {details.done}
          </p>
        )}
        <button type="submit" className="bib-btn bib-btn-main bib-btn-sm" disabled={details.sending}>
          {details.sending ? "Guardando…" : "Guardar"}
        </button>
      </form>

      <form className="pt-card" onSubmit={savePassword}>
        <h2 className="pt-h3">Contraseña</h2>
        <div className="field">
          <label htmlFor="ac-current-2">Contraseña actual</label>
          <PasswordInput id="ac-current-2" name="currentPassword" autoComplete="current-password" invalid={password.fields.includes("currentPassword")} />
        </div>
        <div className="field">
          <label htmlFor="ac-new">Contraseña nueva</label>
          <PasswordInput id="ac-new" name="newPassword" autoComplete="new-password" minLength={PASSWORD_FROM} invalid={password.fields.includes("newPassword")} describedBy="ac-new-hint" />
          <span id="ac-new-hint" className="pt-hint">
            Mínimo {PASSWORD_FROM} caracteres.
          </span>
        </div>
        {password.message && (
          <p className="pt-error" role="alert">
            {password.message}
          </p>
        )}
        {password.done && (
          <p className="pt-saved" role="status">
            {password.done}
          </p>
        )}
        <button type="submit" className="bib-btn bib-btn-line bib-btn-sm" disabled={password.sending}>
          {password.sending ? "Cambiando…" : "Cambiar contraseña"}
        </button>
      </form>

      <button type="button" className="bib-btn bib-btn-line pt-logout" onClick={logout}>
        Cerrar sesión
      </button>
    </>
  );
}
