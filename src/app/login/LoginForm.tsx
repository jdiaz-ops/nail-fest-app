"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Usuario o contraseña incorrectos.");
        setSubmitting(false);
        return;
      }
      const data = await res.json();
      // A full navigation (not router.push) so the server re-reads the
      // just-set cookie on the very next request — router.push alone can
      // race the cookie write in some browsers.
      window.location.href = data.role === "STAFF" ? "/admin/scan" : "/admin";
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 24 }}>
      <div className="field">
        <label htmlFor="username">Usuario</label>
        <input
          id="username"
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginTop: -4, marginBottom: 12 }}>{error}</p>}

      <button className="primary" type="submit" disabled={submitting} style={{ width: "100%" }}>
        {submitting ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
