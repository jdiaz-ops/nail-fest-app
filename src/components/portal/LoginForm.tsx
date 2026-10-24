"use client";

import { useState, type FormEvent } from "react";
import { PasswordInput, send } from "./fields";

type Mode = "login" | "forgot" | "asked";

// "Entrar" (/instructoras/entrar): her username or her email, and her
// password. "¿Olvidaste tu contraseña?" only leaves the request for the
// team, who send her a link by WhatsApp — nothing is emailed for now.
export default function LoginForm({ returnTo = null }: { returnTo?: string | null }) {
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [login, setLogin] = useState("");

  async function enter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    const result = await send("/api/instructoras/entrar", { login, password: String(form.get("password") ?? "") });
    if (result.ok) {
      window.location.assign(returnTo ?? (typeof result.data.next === "string" ? result.data.next : "/instructoras/portal"));
      return;
    }
    setSending(false);
    setError(result.message);
  }

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const result = await send("/api/instructoras/olvide", { login });
    setSending(false);
    if (result.ok) setMode("asked");
    else setError(result.message);
  }

  const switchTo = (next: Mode) => {
    setError(null);
    setMode(next);
  };

  if (mode === "asked") {
    return (
      <div className="pt-card" role="status">
        <h2 className="pt-h3">Listo</h2>
        <p>Si hay una cuenta con ese usuario o correo, el equipo de Nail Fest te escribirá por WhatsApp, al celular de tu cuenta, con un enlace para crear tu contraseña nueva.</p>
        <button type="button" className="pt-link" onClick={() => switchTo("login")}>
          Volver a entrar
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <form className="pt-card" onSubmit={ask}>
        <h2 className="pt-h3">¿Olvidaste tu contraseña?</h2>
        <p>Escribe tu usuario o tu correo. El equipo de Nail Fest te enviará por WhatsApp un enlace para crear una nueva.</p>
        <div className="field">
          <label htmlFor="lg-forgot">Usuario o correo</label>
          <input id="lg-forgot" value={login} onChange={(e) => setLogin(e.target.value)} required maxLength={160} autoComplete="username" autoCapitalize="none" spellCheck={false} />
        </div>
        {error && (
          <p className="pt-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
          {sending ? "Enviando…" : "Pedir el enlace"}
        </button>
        <button type="button" className="pt-link" onClick={() => switchTo("login")}>
          Volver a entrar
        </button>
      </form>
    );
  }

  return (
    <form className="pt-card" onSubmit={enter}>
      <div className="field">
        <label htmlFor="lg-login">Usuario o correo</label>
        <input id="lg-login" value={login} onChange={(e) => setLogin(e.target.value)} required maxLength={160} autoComplete="username" autoCapitalize="none" spellCheck={false} />
      </div>
      <div className="field">
        <label htmlFor="lg-password">Contraseña</label>
        <PasswordInput id="lg-password" autoComplete="current-password" />
      </div>
      {error && (
        <p className="pt-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
        {sending ? "Entrando…" : "Entrar"}
      </button>
      <button type="button" className="pt-link" onClick={() => switchTo("forgot")}>
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}
