"use client";

import { useEffect, useState } from "react";

const REMEMBERED = "nf_correo_de_prueba";

// «Enviar prueba» (2026-10-30): an email to the team's own inbox right now —
// one address or a few, separated by commas, remembered on this browser.
// What gets sent is up to the endpoint; `body` goes with it.
export default function TestSendBox({ url, body, note }: { url: string; body: Record<string, unknown>; note?: string }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    try {
      setEmail(localStorage.getItem(REMEMBERED) ?? "");
    } catch {
      // No storage (private window): the field just starts empty.
    }
  }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setMessage(null);
    try {
      localStorage.setItem(REMEMBERED, email.trim());
    } catch {
      // Not remembered, still sent.
    }
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, email }) }).catch(() => null);
    const answer = res ? await res.json().catch(() => ({})) : {};
    setSending(false);
    setMessage(
      res?.ok
        ? { ok: true, text: `Prueba enviada a ${(answer.sent as string[] | undefined)?.join(", ") ?? email}. Revisa tu bandeja (y la de spam).` }
        : { ok: false, text: answer.message ?? "No se pudo enviar la prueba." }
    );
  }

  return (
    <form onSubmit={send} style={{ marginTop: 16, padding: "14px 16px", border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff", maxWidth: 660 }}>
      <label htmlFor="test-send-email" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
        Enviarme una prueba
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input
          id="test-send-email"
          type="text"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com (varios, separados por coma)"
          style={{ flex: "1 1 260px", minWidth: 0 }}
        />
        <button className="secondary" type="submit" disabled={sending || !email.trim()} style={{ width: "auto", padding: "8px 16px" }}>
          {sending ? "Enviando…" : "Enviar prueba"}
        </button>
      </div>
      {note && <p style={{ fontSize: 12, color: "#5b5f6b", margin: "8px 0 0" }}>{note}</p>}
      {message && <p style={{ fontSize: 13, margin: "8px 0 0", color: message.ok ? "#0e6b4c" : "#a3251f" }}>{message.text}</p>}
    </form>
  );
}
