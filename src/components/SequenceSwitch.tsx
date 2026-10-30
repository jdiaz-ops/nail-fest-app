"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// On or off for a sequence (2026-10-30). Turning it on asks what to do with
// whoever is already in its segment — usually leave them out, so an old
// abandoned cart doesn't get «you left your cart» months later.

const secondary: React.CSSProperties = { width: "auto", background: "#fff", border: "1px solid #e3e1dc", borderRadius: 8, color: "#17181c", fontWeight: 600, cursor: "pointer" };

export default function SequenceSwitch({
  sequenceId,
  enabled,
  enabledAt,
  waiting,
}: {
  sequenceId: string;
  enabled: boolean;
  enabledAt: string | null;
  /** People in the segment right now who never were in this sequence. */
  waiting: number;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function send(next: boolean, includeExisting = false) {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/admin/sequences/${sequenceId}/estado`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next, includeExisting }),
    });
    const answer = await res.json().catch(() => ({}));
    setBusy(false);
    setAsking(false);
    if (!res.ok) {
      setMessage(answer.message ?? "No se pudo cambiar.");
      return;
    }
    router.refresh();
  }

  const box: React.CSSProperties = { background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "14px 18px", marginBottom: 18 };
  const pill = (on: boolean): React.CSSProperties => ({
    fontSize: 12,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    color: on ? "#1f7a4d" : "#6b6f7a",
    background: on ? "#e6f4ec" : "#eceae6",
  });

  if (enabled) {
    return (
      <div style={{ ...box, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={pill(true)}>Encendida</span>
        <span style={{ fontSize: 14, color: "#5b5f6b", flex: 1 }}>
          {enabledAt ? `Desde el ${new Date(enabledAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })}. ` : ""}
          Revisa cada 5 minutos quién entra y sale del segmento. Los mensajes salen de 8 a. m. a 9 p. m.
        </span>
        <button type="button" disabled={busy} onClick={() => send(false)} style={{ ...secondary, padding: "8px 16px" }}>
          Apagar
        </button>
        {message && <span style={{ fontSize: 13, color: "#c2185b" }}>{message}</span>}
      </div>
    );
  }

  return (
    <div style={box}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={pill(false)}>Apagada</span>
        <span style={{ fontSize: 14, color: "#5b5f6b", flex: 1 }}>No le llega nada a nadie mientras esté apagada.</span>
        {!asking && (
          <button type="button" className="primary" disabled={busy} onClick={() => setAsking(true)} style={{ width: "auto", padding: "8px 16px" }}>
            Encender
          </button>
        )}
      </div>
      {asking && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #e3e1dc" }}>
          <p style={{ margin: "0 0 10px", fontSize: 14 }}>
            {waiting === 0
              ? "Nadie está en el segmento todavía: empieza con quien entre desde ahora."
              : waiting === 1
              ? "Ya hay 1 persona en el segmento. ¿Le enviamos la secuencia también?"
              : `Ya hay ${waiting} personas en el segmento. ¿Les enviamos la secuencia también?`}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="primary" disabled={busy} onClick={() => send(true, false)} style={{ width: "auto", padding: "8px 16px" }}>
              {waiting ? "Encender solo para las que entren desde ahora" : "Encender"}
            </button>
            {waiting > 0 && (
              <button type="button" disabled={busy} onClick={() => send(true, true)} style={{ ...secondary, padding: "8px 16px" }}>
                Encender e incluirlas también
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => setAsking(false)} style={{ background: "none", border: "none", color: "#5b5f6b", cursor: "pointer", fontSize: 14 }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {message && <p style={{ margin: "10px 0 0", fontSize: 13, color: "#c2185b" }}>{message}</p>}
    </div>
  );
}
