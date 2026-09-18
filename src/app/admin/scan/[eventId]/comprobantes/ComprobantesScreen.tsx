"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ComprobanteEstado, ComprobanteMedio } from "@prisma/client";
import type { PendienteView } from "@/lib/comprobantes/types";
import { MEDIO_LABEL } from "@/lib/comprobantes/types";
import { SearchIcon } from "../../icons";
import CaptureModal from "./CaptureModal";

export interface ComprobanteView {
  id: string;
  pendienteId: string | null;
  medio: ComprobanteMedio;
  pagadoPor: string;
  nota: string | null;
  estado: ComprobanteEstado;
  ultimoError: string | null;
  createdAt: string;
}

// A submission still in flight on THIS device, before the server even has
// a row for it (uploading files, or waiting on the create call) — shown
// in Sección C ahead of the real ComprobanteView list so "Enviando…"
// appears the instant someone taps Enviar, per "la interfaz no se
// bloquea mientras sube. El usuario puede tomar otro comprobante de
// inmediato." Removed the moment the real row exists (see
// ComprobantesScreen's own submitCapture).
export interface QueuedComprobante {
  localId: string;
  status: "subiendo" | "enviando" | "error";
  error?: string;
}

const REFRESH_MS = 20_000;

const DIAS_COLOR: Record<"ok" | "warn" | "danger", string> = {
  ok: "#5b5f6b",
  warn: "#8a5a1f",
  danger: "#a3212b",
};
function diasSeverity(dias: number): "ok" | "warn" | "danger" {
  if (dias > 7) return "danger";
  if (dias > 2) return "warn";
  return "ok";
}

const ESTADO_LABEL: Record<ComprobanteEstado, string> = {
  ENVIANDO: "Enviando…",
  RECIBIDO: "Recibido",
  ENLAZADO: "Enlazado ✔",
  EN_REVISION: "En revisión",
  ERROR: "Error — reintentar",
};
const ESTADO_COLOR: Record<ComprobanteEstado, string> = {
  ENVIANDO: "#8a5a1f",
  RECIBIDO: "#5b5f6b",
  ENLAZADO: "#0e6b4c",
  EN_REVISION: "#8a5a1f",
  ERROR: "#a3212b",
};

function formatCOP(n: number): string {
  return `$${n.toLocaleString("es-CO")}`;
}
function formatFechaCorta(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export default function ComprobantesScreen({
  initialPendientes,
  initialActualizado,
  initialComprobantes,
  currentUserName,
}: {
  initialPendientes: PendienteView[];
  initialActualizado: string;
  initialComprobantes: ComprobanteView[];
  currentUserName: string;
}) {
  const [pendientes, setPendientes] = useState(initialPendientes);
  const [actualizado, setActualizado] = useState(initialActualizado);
  const [comprobantes, setComprobantes] = useState(initialComprobantes);
  const [queue, setQueue] = useState<QueuedComprobante[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [captureTarget, setCaptureTarget] = useState<PendienteView | "nuevo" | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [pendientesRes, comprobantesRes] = await Promise.all([
        fetch("/api/comprobantes/pendientes", { cache: "no-store" }),
        fetch("/api/comprobantes", { cache: "no-store" }),
      ]);
      if (pendientesRes.ok) {
        const body = await pendientesRes.json();
        setPendientes(body.pendientes);
        setActualizado(body.actualizado);
      }
      if (comprobantesRes.ok) {
        const body = await comprobantesRes.json();
        setComprobantes(body.comprobantes);
      }
    } catch {
      // Best-effort — keep whatever was last shown over a transient hiccup.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  async function pullToRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  const filteredPendientes = search.trim()
    ? pendientes.filter((p) => String(p.monto).includes(search.replace(/\D/g, "")))
    : pendientes;

  function enqueue(localId: string) {
    setQueue((q) => [{ localId, status: "subiendo" }, ...q]);
  }
  function updateQueueStatus(localId: string, status: QueuedComprobante["status"], error?: string) {
    setQueue((q) => q.map((it) => (it.localId === localId ? { ...it, status, error } : it)));
  }
  function dequeue(localId: string) {
    setQueue((q) => q.filter((it) => it.localId !== localId));
  }

  async function retryComprobante(id: string) {
    setComprobantes((cs) => cs.map((c) => (c.id === id ? { ...c, estado: "ENVIANDO" } : c)));
    try {
      await fetch(`/api/comprobantes/${id}/reintentar`, { method: "POST" });
    } finally {
      refresh();
    }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0 10px" }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>Comprobantes</h2>
        <button type="button" onClick={pullToRefresh} disabled={refreshing} style={refreshButtonStyle}>
          {refreshing ? "Actualizando…" : "↻ Actualizar"}
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: "#8a8478", margin: "0 0 16px" }}>
        Actualizado: {new Date(actualizado).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
      </p>

      {/* Sección B — fijo arriba, no al final, para que sea lo primero que
          se toca al abrir la app con la tarjeta en la mano. */}
      <button type="button" onClick={() => setCaptureTarget("nuevo")} style={nuevoButtonStyle}>
        + Nuevo comprobante
      </button>

      {/* Sección A */}
      <section style={{ marginTop: 20 }}>
        <h3 style={sectionTitleStyle}>Pagos sin soporte</h3>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8a8478" }}>
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por monto — ej. 85000"
            inputMode="numeric"
            style={{ width: "100%", padding: "9px 12px 9px 34px", border: "1px solid #e3e1dc", borderRadius: 8, fontSize: 14 }}
          />
        </div>

        {filteredPendientes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a8478" }}>
            {pendientes.length === 0 ? "No hay pagos sin soporte pendientes." : "Ningún pago coincide con ese monto."}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filteredPendientes.map((p) => {
              const severity = diasSeverity(p.dias);
              return (
                <button key={p.id} type="button" onClick={() => setCaptureTarget(p)} style={pendienteRowStyle}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.descripcion}
                    </div>
                    <div style={{ fontSize: 12, color: "#8a8478", marginTop: 2 }}>
                      {formatFechaCorta(p.fecha)} · {p.cuenta}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{formatCOP(p.monto)}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: DIAS_COLOR[severity] }}>
                      {p.dias} {p.dias === 1 ? "día" : "días"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Sección C */}
      <section style={{ marginTop: 24 }}>
        <h3 style={sectionTitleStyle}>Enviados recientemente</h3>
        {queue.length === 0 && comprobantes.length === 0 ? (
          <p style={{ fontSize: 13, color: "#8a8478" }}>Todavía no has enviado ningún comprobante.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {queue.map((q) => (
              <div key={q.localId} style={recienteRowStyle}>
                <div style={{ fontSize: 13.5 }}>Comprobante</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: q.status === "error" ? "#a3212b" : "#8a5a1f" }}>
                  {q.status === "subiendo" ? "Subiendo…" : q.status === "enviando" ? "Enviando…" : "Error"}
                </div>
              </div>
            ))}
            {comprobantes.map((c) => (
              <div key={c.id} style={recienteRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {MEDIO_LABEL[c.medio]}
                    {c.nota ? ` · ${c.nota}` : ""}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8a8478", marginTop: 2 }}>
                    {new Date(c.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                {c.estado === "ERROR" ? (
                  <button type="button" onClick={() => retryComprobante(c.id)} style={retryButtonStyle}>
                    Error — reintentar
                  </button>
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: ESTADO_COLOR[c.estado], flexShrink: 0 }}>{ESTADO_LABEL[c.estado]}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {captureTarget && (
        <CaptureModal
          pendiente={captureTarget === "nuevo" ? null : captureTarget}
          currentUserName={currentUserName}
          onClose={() => setCaptureTarget(null)}
          onQueued={enqueue}
          onQueueStatus={updateQueueStatus}
          onDone={(localId) => {
            dequeue(localId);
            refresh();
          }}
        />
      )}
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 10px" };

const refreshButtonStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid #e3e1dc",
  background: "#fff",
  cursor: "pointer",
};

const nuevoButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px",
  borderRadius: 12,
  border: "none",
  background: "#12966b",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
};

const pendienteRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  textAlign: "left",
  padding: "12px 14px",
  border: "1px solid #e3e1dc",
  borderRadius: 10,
  background: "#fff",
  cursor: "pointer",
};

const recienteRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid #e3e1dc",
  borderRadius: 10,
  background: "#fff",
};

const retryButtonStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#a3212b",
  background: "#fbe9ea",
  border: "none",
  borderRadius: 999,
  padding: "5px 10px",
  cursor: "pointer",
  flexShrink: 0,
};
