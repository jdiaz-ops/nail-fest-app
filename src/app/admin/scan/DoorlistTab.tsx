"use client";

import { useMemo, useState } from "react";
import { useScanApp } from "./ScanAppContext";
import { CheckCircleIcon, SearchIcon } from "./icons";
import { playSoundForResult } from "@/lib/scanSounds";

// The real fallback for "their QR won't scan" — a phone with a dead
// screen, a photo of the ticket too blurry to decode, someone who lost
// the email entirely. Search by name instead of by code, tap to check
// in. Reads/writes through the exact same offline-safe submitToken() the
// Scanner tab uses — a manual check-in from here is just as safe under a
// dropped connection as a camera scan is, no separate code path to keep
// in sync.
export default function DoorlistTab() {
  const { rosterEntries, rosterVersion, submitToken, roster } = useScanApp();
  const [query, setQuery] = useState("");
  const [busyToken, setBusyToken] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  // rosterVersion is read only to force this memo to recompute — the
  // actual data comes fresh from localStorage via rosterEntries() each
  // time, since that's also where submitToken's offline path writes.
  const entries = useMemo(() => {
    void rosterVersion;
    return rosterEntries().sort((a, b) => (a.personName ?? "").localeCompare(b.personName ?? "", "es"));
  }, [rosterEntries, rosterVersion]);

  const filtered = query.trim()
    ? entries.filter((e) => (e.personName ?? "").toLowerCase().includes(query.trim().toLowerCase()))
    : entries;

  async function handleTap(entry: (typeof entries)[number]) {
    const verb = entry.checkedIn ? "registrar un reingreso para" : "marcar la entrada de";
    if (!confirm(`¿Quieres ${verb} ${entry.personName || "esta persona"}?`)) return;
    setBusyToken(entry.token);
    const outcome = await submitToken(entry.token);
    setBusyToken(null);
    playSoundForResult(outcome.kind);
    const label =
      outcome.kind === "VALID_FIRST"
        ? "Entrada registrada"
        : outcome.kind === "VALID_REENTRY"
          ? "Reingreso registrado"
          : outcome.kind === "OFFLINE_UNKNOWN"
            ? "No se pudo verificar sin conexión"
            : "No se pudo registrar";
    setToast({ text: `${entry.personName ?? ""} — ${label}${outcome.offline ? " (sin conexión, pendiente)" : ""}`, ok: outcome.kind === "VALID_FIRST" || outcome.kind === "VALID_REENTRY" });
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div>
      {toast && (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 12,
            borderRadius: 8,
            fontSize: 13,
            background: toast.ok ? "#e8f6ef" : "#fbe9ea",
            color: toast.ok ? "#0e6b4c" : "#a3212b",
          }}
        >
          {toast.text}
        </div>
      )}

      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8a8478" }}>
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre…"
          style={{ width: "100%", padding: "10px 12px 10px 36px" }}
        />
      </div>

      {!roster ? (
        <p style={{ color: "#5b5f6b", fontSize: 13 }}>
          Aún no se han descargado los datos de este evento — necesitas conexión al menos una vez (ver arriba).
        </p>
      ) : filtered.length === 0 ? (
        <p style={{ color: "#5b5f6b", fontSize: 13 }}>{query ? "Nadie coincide con esa búsqueda." : "No hay inscritos para este evento."}</p>
      ) : (
        <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflow: "hidden" }}>
          {filtered.map((entry, i) => (
            <button
              key={entry.token}
              onClick={() => handleTap(entry)}
              disabled={busyToken === entry.token}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "12px 14px",
                background: "#fff",
                border: "none",
                borderTop: i === 0 ? "none" : "1px solid #f0efec",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <CheckCircleIcon filled={entry.checkedIn} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {entry.personName || "(sin nombre)"}
                </div>
                {entry.ticketTypeName && <div style={{ fontSize: 12, color: "#5b5f6b" }}>{entry.ticketTypeName}</div>}
              </div>
              {busyToken === entry.token && <span style={{ fontSize: 12, color: "#5b5f6b" }}>…</span>}
            </button>
          ))}
        </div>
      )}

      <p style={{ marginTop: 20, fontSize: 12, color: "#5b5f6b" }}>
        Toca a alguien para registrar su entrada manualmente — útil cuando su código QR no se puede escanear.
        Funciona igual con o sin conexión, exactamente como el escáner.
      </p>
    </div>
  );
}
