"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PASSWORD_FROM } from "@/lib/community/consultorio";
import { PasswordInput, send } from "@/components/portal/fields";

type Problem = { message: string; fields: string[] } | null;

function ErrorLine({ problem }: { problem: Problem }) {
  return problem ? (
    <p className="pt-error" role="alert">
      {problem.message}
    </p>
  ) : null;
}

/** "Crea tu cuenta" (/cuenta/crear): her name and city go with what she
 * posts; her email and password, to come back from any phone. */
export function MemberSignupForm({ returnTo }: { returnTo: string }) {
  const [problem, setProblem] = useState<Problem>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (key: string) => String(form.get(key) ?? "");
    setSending(true);
    setProblem(null);
    const result = await send("/api/cuenta/crear", {
      name: text("name"),
      city: text("city"),
      email: text("email"),
      password: text("password"),
      acceptTerms: form.get("acceptTerms") === "on",
      website: text("website"),
    });
    if (result.ok) {
      window.location.assign(returnTo);
      return;
    }
    setSending(false);
    setProblem({ message: result.message ?? "Revisa los datos.", fields: result.fields });
  }

  const bad = (field: string) => Boolean(problem?.fields.includes(field)) || undefined;
  return (
    <form className="pt-card" onSubmit={submit}>
      <div className="field">
        <label htmlFor="mc-name">Tu nombre</label>
        <input id="mc-name" name="name" required minLength={2} maxLength={60} autoComplete="given-name" aria-invalid={bad("name")} aria-describedby="mc-name-hint" />
        <span id="mc-name-hint" className="pt-hint">
          Sale con tus preguntas y respuestas. Puede ser solo tu nombre.
        </span>
      </div>
      <div className="field">
        <label htmlFor="mc-city">Tu ciudad</label>
        <input id="mc-city" name="city" required minLength={2} maxLength={60} autoComplete="address-level2" aria-invalid={bad("city")} />
      </div>
      <div className="field">
        <label htmlFor="mc-email">Correo</label>
        <input id="mc-email" name="email" type="email" required maxLength={160} autoComplete="email" aria-invalid={bad("email")} aria-describedby="mc-email-hint" />
        <span id="mc-email-hint" className="pt-hint">
          Para entrar a tu cuenta. No se publica.
        </span>
      </div>
      <div className="field">
        <label htmlFor="mc-password">Contraseña</label>
        <PasswordInput id="mc-password" autoComplete="new-password" minLength={PASSWORD_FROM} invalid={bad("password")} describedBy="mc-password-hint" />
        <span id="mc-password-hint" className="pt-hint">
          Mínimo {PASSWORD_FROM} caracteres.
        </span>
      </div>
      <div className="bib-hp" aria-hidden="true">
        <label htmlFor="mc-website">No llenar</label>
        <input id="mc-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="bib-check">
        <input type="checkbox" name="acceptTerms" required />
        <span>
          Acepto las reglas del Consultorio y la{" "}
          <a href="/privacidad#comunidad" target="_blank">
            política de privacidad
          </a>
          .
        </span>
      </label>
      <ErrorLine problem={problem} />
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
        {sending ? "Creando tu cuenta…" : "Crear mi cuenta"}
      </button>
    </form>
  );
}

type LoginMode = "login" | "forgot" | "asked";

/** "Entrar" (/cuenta/entrar), with «¿Olvidaste tu contraseña?» — which
 * only leaves the request for the team. */
export function MemberLoginForm({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState<LoginMode>("login");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<Problem>(null);
  const [sending, setSending] = useState(false);

  async function enter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setProblem(null);
    const result = await send("/api/cuenta/entrar", { email, password: String(form.get("password") ?? "") });
    if (result.ok) {
      window.location.assign(returnTo);
      return;
    }
    setSending(false);
    setProblem({ message: result.message ?? "No se pudo entrar.", fields: result.fields });
  }

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    setProblem(null);
    const result = await send("/api/cuenta/olvide", { email });
    setSending(false);
    if (result.ok) setMode("asked");
    else setProblem({ message: result.message ?? "No se pudo enviar.", fields: result.fields });
  }

  const go = (next: LoginMode) => {
    setProblem(null);
    setMode(next);
  };

  if (mode === "asked") {
    return (
      <div className="pt-card" role="status">
        <h2 className="pt-h3">Listo</h2>
        <p>Si hay una cuenta con ese correo, el equipo de Nail Fest te enviará un enlace para crear tu contraseña nueva.</p>
        <button type="button" className="pt-link" onClick={() => go("login")}>
          Volver a entrar
        </button>
      </div>
    );
  }

  if (mode === "forgot") {
    return (
      <form className="pt-card" onSubmit={ask}>
        <h2 className="pt-h3">¿Olvidaste tu contraseña?</h2>
        <p>Escribe tu correo. El equipo de Nail Fest te enviará un enlace para crear una nueva.</p>
        <div className="field">
          <label htmlFor="ml-forgot">Correo</label>
          <input id="ml-forgot" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} autoComplete="email" />
        </div>
        <ErrorLine problem={problem} />
        <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
          {sending ? "Enviando…" : "Pedir el enlace"}
        </button>
        <button type="button" className="pt-link" onClick={() => go("login")}>
          Volver a entrar
        </button>
      </form>
    );
  }

  return (
    <form className="pt-card" onSubmit={enter}>
      <div className="field">
        <label htmlFor="ml-email">Correo</label>
        <input id="ml-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={160} autoComplete="email" />
      </div>
      <div className="field">
        <label htmlFor="ml-password">Contraseña</label>
        <PasswordInput id="ml-password" autoComplete="current-password" />
      </div>
      <ErrorLine problem={problem} />
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
        {sending ? "Entrando…" : "Entrar"}
      </button>
      <button type="button" className="pt-link" onClick={() => go("forgot")}>
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}

/** A link the team sent: her new password. */
export function MemberResetForm({ token }: { token: string }) {
  const [problem, setProblem] = useState<Problem>(null);
  const [spent, setSpent] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setSending(true);
    setProblem(null);
    const result = await send("/api/cuenta/clave", { token, password: String(form.get("password") ?? "") });
    if (result.ok) {
      window.location.assign("/consultorio");
      return;
    }
    setSending(false);
    if (result.data.error === "expired") setSpent(result.message);
    else setProblem({ message: result.message ?? "Revisa los datos.", fields: result.fields });
  }

  if (spent) {
    return (
      <div className="pt-card" role="alert">
        <p>{spent}</p>
        <Link href="/cuenta/entrar" className="bib-btn bib-btn-line bib-btn-sm">
          Ir a entrar
        </Link>
      </div>
    );
  }
  return (
    <form className="pt-card" onSubmit={submit}>
      <div className="field">
        <label htmlFor="mr-password">Contraseña nueva</label>
        <PasswordInput id="mr-password" autoComplete="new-password" minLength={PASSWORD_FROM} invalid={Boolean(problem)} describedBy="mr-password-hint" />
        <span id="mr-password-hint" className="pt-hint">
          Mínimo {PASSWORD_FROM} caracteres.
        </span>
      </div>
      <ErrorLine problem={problem} />
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={sending}>
        {sending ? "Guardando…" : "Guardar y entrar"}
      </button>
    </form>
  );
}

type Status = { sending: boolean; done: string | null; problem: Problem };
const IDLE: Status = { sending: false, done: null, problem: null };

/** "Mi cuenta": name and city, email, password, and the way out. */
export function MemberAccountForm({ name, city, email }: { name: string; city: string; email: string }) {
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
      "/api/cuenta",
      {
        name: String(form.get("name") ?? ""),
        city: String(form.get("city") ?? ""),
        email: newEmail,
        ...(emailChanged ? { currentPassword: String(form.get("currentPassword") ?? "") } : {}),
      },
      "PATCH",
    );
    if (!result.ok) {
      setDetails({ ...IDLE, problem: { message: result.message ?? "Revisa los datos.", fields: result.fields } });
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
    const result = await send("/api/cuenta", { currentPassword: String(form.get("currentPassword") ?? ""), newPassword: String(form.get("newPassword") ?? "") }, "PATCH");
    if (!result.ok) {
      setPassword({ ...IDLE, problem: { message: result.message ?? "Revisa los datos.", fields: result.fields } });
      return;
    }
    formEl.reset();
    setPassword({ ...IDLE, done: "Listo: tu contraseña cambió." });
  }

  async function logout() {
    await send("/api/cuenta/salir");
    window.location.assign("/consultorio");
  }

  return (
    <>
      <form className="pt-card" onSubmit={saveDetails}>
        <h2 className="pt-h3">Tus datos</h2>
        <div className="field">
          <label htmlFor="ma-name">Tu nombre</label>
          <input id="ma-name" name="name" defaultValue={name} required minLength={2} maxLength={60} autoComplete="given-name" />
        </div>
        <div className="field">
          <label htmlFor="ma-city">Tu ciudad</label>
          <input id="ma-city" name="city" defaultValue={city} required minLength={2} maxLength={60} autoComplete="address-level2" />
          <span className="pt-hint">Tu nombre y tu ciudad salen con lo que publicas en el Consultorio.</span>
        </div>
        <div className="field">
          <label htmlFor="ma-email">Correo</label>
          <input id="ma-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required maxLength={160} autoComplete="email" />
        </div>
        {emailChanged && (
          <div className="field">
            <label htmlFor="ma-current-1">Tu contraseña actual</label>
            <PasswordInput id="ma-current-1" name="currentPassword" autoComplete="current-password" />
            <span className="pt-hint">Para cambiar el correo te la pedimos.</span>
          </div>
        )}
        <ErrorLine problem={details.problem} />
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
          <label htmlFor="ma-current-2">Contraseña actual</label>
          <PasswordInput id="ma-current-2" name="currentPassword" autoComplete="current-password" />
        </div>
        <div className="field">
          <label htmlFor="ma-new">Contraseña nueva</label>
          <PasswordInput id="ma-new" name="newPassword" autoComplete="new-password" minLength={PASSWORD_FROM} />
        </div>
        <ErrorLine problem={password.problem} />
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
