"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Row actions for one difusión. No retry button here any more: retries
// run on their own after a send (lib/autoRetry.ts) and the Fallidos page
// offers a manual one only once those are through. "Reanudar envío"
// shows only for a send that is stuck (see isBroadcastStuck in
// lib/broadcastProgress.ts) — the chunk watchdog normally resumes a
// crashed send by itself. «Detener envío» (2026-11-07) on one going out or
// scheduled: it stops, and its history stays. For one stopped or sent to a
// segment, who got it (a CSV) and a segment of the ones it didn't reach.
export default function WhatsAppBroadcastRowActions({ id, isStuck, status, hasSegment }: { id: string; isStuck?: boolean; status?: string; hasSegment?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleResume() {
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}/resume`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    alert(
      body?.error === "in_progress"
        ? "Este envío ya está en curso — otra ejecución lo está procesando. Espera un par de minutos y recarga la página antes de volver a reanudar."
        : "No se pudo reanudar — intenta de nuevo."
    );
  }

  async function handleStop() {
    const going = status === "SENDING";
    if (
      !confirm(
        going
          ? "¿Detener este envío? Deja de salir en segundos: lo que ya salió no se puede revocar, y el resto no se envía. Queda en la lista como «Detenido», con sus números."
          : "¿Anular esta difusión programada? No se enviará a nadie. Queda en la lista como «Detenido»."
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}/detener`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body?.message ?? "No se pudo detener. Vuelve a intentarlo.");
    }
    router.refresh();
  }

  async function handleNotReached() {
    if (!confirm("¿Crear un segmento con los que no la recibieron? Tiene las mismas condiciones que el de esta difusión, sin las personas que ya la recibieron.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}/no-recibieron`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(body?.message ?? "No se pudo crear el segmento. Vuelve a intentarlo.");
      return;
    }
    const missed = body.failed + body.none;
    alert(
      `Listo: segmento «${body.segmentName}» con ${missed.toLocaleString("es-CO")} personas que no la recibieron ` +
        `(${body.failed.toLocaleString("es-CO")} fallaron, ${body.none.toLocaleString("es-CO")} no alcanzaron a recibirla). ` +
        `Deja fuera a las ${body.received.toLocaleString("es-CO")} que ya la recibieron.`,
    );
    router.push("/admin/crm/segments");
  }

  async function handleDelete() {
    if (!confirm("¿Borrar esta difusión y su historial de envío? Esto no revoca nada ya enviado en WhatsApp.")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/whatsapp/broadcasts/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {(status === "SENDING" || status === "QUEUED") && (
        <button type="button" onClick={handleStop} disabled={busy} style={{ background: "none", border: "none", color: "#a3212b", cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 700 }}>
          {busy ? "Deteniendo…" : status === "SENDING" ? "Detener envío" : "Anular"}
        </button>
      )}
      {hasSegment && (status === "CANCELLED" || status === "SENT") && (
        <>
          <button type="button" onClick={handleNotReached} disabled={busy} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 700 }}>
            {busy ? "Creando…" : "Segmento: no la recibieron"}
          </button>
          <a href={`/api/admin/whatsapp/broadcasts/${id}/recibidos-csv`} style={{ fontSize: 13, color: "#0e6b4c" }}>
            Quién la recibió (CSV)
          </a>
        </>
      )}
      {isStuck && (
        <button type="button" onClick={handleResume} disabled={busy} style={{ background: "none", border: "none", color: "#0e6b4c", cursor: "pointer", fontSize: 13, padding: 0, fontWeight: 600 }}>
          {busy ? "Reanudando…" : "Reanudar envío"}
        </button>
      )}
      <button type="button" onClick={handleDelete} disabled={busy} style={{ background: "none", border: "none", color: "#c2185b", cursor: "pointer", fontSize: 13, padding: 0 }}>
        Borrar
      </button>
    </div>
  );
}
