"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { formatDateInTz } from "@/lib/dateFormat";
import {
  saveRoster,
  previewOutcome,
  bumpLocalCheckIn,
  rosterInfo,
  getQueue,
  enqueueScan,
  dequeueScans,
  queueLength,
  type LocalPreview,
} from "@/lib/offlineScan";

interface EventOption {
  id: string;
  slug: string;
  name: string;
  city: string;
  startsAt: string;
}

type ApiResultKind = "VALID_FIRST" | "VALID_REENTRY" | "WRONG_EVENT" | "INVALID_TOKEN" | "NOT_FOUND";

interface ScanApiResult {
  result: ApiResultKind;
  personName?: string;
  eventName?: string;
  actualEventName?: string;
  previousScanAt?: string;
}

// What's actually shown on screen — a real, server-confirmed result OR a
// local, offline preview that hasn't been confirmed yet. `offline: true`
// on ANY of these means "don't treat this as final" — see the badge in
// the render below, which is the one thing standing between a staff
// member and mistakenly treating a guess as a fact.
type DisplayKind = ApiResultKind | "OFFLINE_UNKNOWN" | "REQUEST_ERROR";
interface DisplayOutcome {
  kind: DisplayKind;
  offline: boolean;
  personName?: string;
  ticketTypeName?: string;
  eventName?: string;
  actualEventName?: string;
  previousScanAt?: string;
}

const RESULT_COPY: Record<DisplayKind, { emoji: string; label: string; color: string }> = {
  VALID_FIRST: { emoji: "✅", label: "Entrada válida", color: "#1f7a5c" },
  VALID_REENTRY: { emoji: "🔁", label: "Reingreso — ya había entrado", color: "#b8791a" },
  WRONG_EVENT: { emoji: "⚠️", label: "Boleto de OTRO evento", color: "#b8791a" },
  INVALID_TOKEN: { emoji: "❌", label: "Código inválido", color: "#c2185b" },
  NOT_FOUND: { emoji: "❌", label: "No existe ese registro", color: "#c2185b" },
  // Deliberately amber, not red — an unrecognized code while offline is
  // NOT the same claim as INVALID_TOKEN/NOT_FOUND (which mean the server
  // itself checked and rejected it). It might just be a registration
  // newer than the last download. Never read this as "reject at the
  // door" — see the copy in the card itself.
  OFFLINE_UNKNOWN: { emoji: "🕓", label: "No reconocido sin conexión", color: "#b8791a" },
  REQUEST_ERROR: { emoji: "⚠️", label: "Error técnico — no se pudo verificar", color: "#c2185b" },
};

// Same-token re-scans while the QR is still sitting in frame shouldn't fire
// the API twice — the decode loop runs many times a second.
const RESCAN_COOLDOWN_MS = 2500;
// How long a live attempt gets before this is treated as "no connection
// right now" and falls back to the local/offline path — short enough that
// a real outage doesn't leave staff staring at a spinner, long enough
// that a normal slow-but-working mobile connection still succeeds.
const LIVE_TIMEOUT_MS = 6000;
const SYNC_INTERVAL_MS = 20_000;
const ROSTER_REFRESH_INTERVAL_MS = 5 * 60_000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function previewToDisplay(preview: LocalPreview): DisplayOutcome {
  if (preview.kind === "unknown") return { kind: "OFFLINE_UNKNOWN", offline: true };
  return {
    kind: preview.kind === "valid_first" ? "VALID_FIRST" : "VALID_REENTRY",
    offline: true,
    personName: preview.personName,
    ticketTypeName: preview.ticketTypeName,
  };
}

export default function ScanClient({ events, timezone, language }: { events: EventOption[]; timezone: string; language: string }) {
  const [eventId, setEventId] = useState<string>("");
  const [scannerLabel, setScannerLabel] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<DisplayOutcome | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [roster, setRoster] = useState<{ count: number; downloadedAt: string } | null>(null);
  const [downloadingRoster, setDownloadingRoster] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);
  // Avoids a stale closure over `eventId`/`checking` inside the rAF loop,
  // which is set up once and would otherwise keep seeing their initial values.
  const eventIdRef = useRef(eventId);
  const checkingRef = useRef(checking);
  const syncingRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("nf_scan_event");
    if (saved) setEventId(saved);
    const savedLabel = localStorage.getItem("nf_scan_label");
    if (savedLabel) setScannerLabel(savedLabel);
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    setPendingCount(queueLength());
  }, []);

  useEffect(() => {
    eventIdRef.current = eventId;
    if (eventId) localStorage.setItem("nf_scan_event", eventId);
  }, [eventId]);

  useEffect(() => {
    checkingRef.current = checking;
  }, [checking]);

  // ------------------------------------------------------------------
  // Roster download — the actual offline-mode data. Runs in the
  // background: never blocks scanning, and a failed download just means
  // "keep whatever's already cached" rather than an error the door staff
  // has to deal with.
  // ------------------------------------------------------------------
  const downloadRoster = useCallback(async (id: string) => {
    if (!id) return;
    setDownloadingRoster(true);
    try {
      const res = await fetchWithTimeout(`/api/admin/scan/roster?eventId=${id}`, {}, LIVE_TIMEOUT_MS);
      if (!res.ok) return;
      const data = await res.json();
      saveRoster({ eventId: id, eventName: data.eventName, entries: data.entries });
      setRoster(rosterInfo(id));
      setIsOnline(true);
    } catch {
      // No connection right now — leave whatever's already cached alone.
    } finally {
      setDownloadingRoster(false);
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setRoster(rosterInfo(eventId));
    downloadRoster(eventId);
    const interval = setInterval(() => downloadRoster(eventId), ROSTER_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [eventId, downloadRoster]);

  // ------------------------------------------------------------------
  // Offline queue sync — replays whatever built up while disconnected.
  // Triggered on mount, on the browser's own online event, periodically,
  // and by the manual button — any one of those is enough to eventually
  // catch a connection coming back, since none of them alone is fully
  // reliable (navigator/'online' event notoriously fires on "connected to
  // a WiFi with no real internet", and a dead interval tab in the
  // background can get throttled).
  // ------------------------------------------------------------------
  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = getQueue();
    if (queue.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const byEvent = new Map<string, typeof queue>();
      for (const item of queue) {
        const list = byEvent.get(item.eventId) ?? [];
        list.push(item);
        byEvent.set(item.eventId, list);
      }
      let anySuccess = false;
      for (const [evId, items] of byEvent) {
        // Defensive chunking to match the server's own cap — a real outage
        // realistically never queues this many, but a stuck device left
        // running for days shouldn't be able to send an unbounded request.
        for (let i = 0; i < items.length; i += 200) {
          const chunk = items.slice(i, i + 200);
          try {
            const res = await fetchWithTimeout(
              "/api/admin/scan/sync",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  eventId: evId,
                  scans: chunk.map((q) => ({
                    token: q.token,
                    scannerLabel: q.scannerLabel,
                    scannedAt: q.scannedAt,
                    clientScanId: q.clientScanId,
                  })),
                }),
              },
              LIVE_TIMEOUT_MS * 2 // a batch legitimately takes longer than one scan
            );
            if (!res.ok) continue; // still offline, or a real server error — leave this chunk queued
            const data: { results: { clientScanId: string; ok: boolean }[] } = await res.json();
            const confirmed = data.results.filter((r) => r.ok).map((r) => r.clientScanId);
            if (confirmed.length > 0) {
              dequeueScans(confirmed);
              anySuccess = true;
            }
          } catch {
            // This chunk failed outright (still no connection) — stop
            // trying the rest of this event's items for now, next
            // interval/online-event will pick back up where the queue
            // left off.
            break;
          }
        }
      }
      setPendingCount(queueLength());
      if (anySuccess) {
        setIsOnline(true);
        setAuthError(false);
        // Other devices may have checked people in for this event while
        // this one was offline — refresh so the local preview stays
        // accurate, not just "whatever this phone alone has seen".
        if (eventIdRef.current) downloadRoster(eventIdRef.current);
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [downloadRoster]);

  useEffect(() => {
    syncQueue();
    const interval = setInterval(syncQueue, SYNC_INTERVAL_MS);
    window.addEventListener("online", syncQueue);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", syncQueue);
    };
  }, [syncQueue]);

  // ------------------------------------------------------------------
  // The actual scan submission — one path for both the camera loop and
  // manual entry. Always tries the server first; only falls back to the
  // local preview + queue when that attempt genuinely fails (network
  // error, timeout, or a 5xx that suggests the server itself is having
  // trouble) — never when it succeeds-but-rejects (that's a REAL answer,
  // not a connectivity problem).
  // ------------------------------------------------------------------
  const submitToken = useCallback(
    async (token: string) => {
      const currentEventId = eventIdRef.current;
      if (!currentEventId) return;
      setChecking(true);
      checkingRef.current = true;

      const clientScanId = crypto.randomUUID();
      const scannedAt = new Date().toISOString();
      const label = scannerLabel || undefined;

      try {
        const res = await fetchWithTimeout(
          "/api/admin/scan",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, eventId: currentEventId, scannerLabel: label, scannedAt, clientScanId }),
          },
          LIVE_TIMEOUT_MS
        );

        if (res.ok) {
          const data: ScanApiResult = await res.json();
          setIsOnline(true);
          setAuthError(false);
          setOutcome({ kind: data.result, offline: false, ...data });
          return;
        }

        if (res.status === 401 || res.status === 403) {
          // Reached the server fine — this isn't a connectivity problem,
          // it's a real auth problem (session expired/deactivated). Still
          // queue the attempt (worth one retry once whoever's logged in
          // fixes it), but say so plainly rather than pretending it's a
          // normal offline moment.
          setIsOnline(true);
          setAuthError(true);
          const preview = previewOutcome(currentEventId, token);
          bumpLocalCheckIn(currentEventId, token);
          enqueueScan({ clientScanId, eventId: currentEventId, token, scannerLabel: label, scannedAt });
          setPendingCount(queueLength());
          setOutcome(previewToDisplay(preview));
          return;
        }

        if (res.status >= 500) {
          // The server itself is unhappy — treat like an outage from the
          // scanning app's point of view; queue and retry later.
          throw new Error(`server_error_${res.status}`);
        }

        // Any other status (400 invalid_body, etc.) is a real client bug,
        // not something a retry fixes — surface it plainly instead of
        // silently swallowing it into the offline queue.
        console.error("scan request rejected", res.status, await res.text().catch(() => ""));
        setOutcome({ kind: "REQUEST_ERROR", offline: false });
        return;
      } catch {
        // Network error, timeout/abort, or the 5xx re-thrown above — this
        // is the actual "no connection right now" path.
        setIsOnline(false);
        const preview = previewOutcome(currentEventId, token);
        bumpLocalCheckIn(currentEventId, token);
        enqueueScan({ clientScanId, eventId: currentEventId, token, scannerLabel: label, scannedAt });
        setPendingCount(queueLength());
        setOutcome(previewToDisplay(preview));
      } finally {
        setChecking(false);
        checkingRef.current = false;
      }
    },
    [scannerLabel]
  );

  const handleDecoded = useCallback(
    (token: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.token === token && now - last.at < RESCAN_COOLDOWN_MS) return;
      if (checkingRef.current) return;
      if (!eventIdRef.current) return;
      lastScanRef.current = { token, at: now };
      submitToken(token);
    },
    [submitToken]
  );

  // Camera + decode loop — set up once; reads current event/checking via refs.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Este navegador no da acceso a la cámara aquí (¿estás en HTTP en vez de HTTPS?).");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        loop();
      } catch (err) {
        setCameraError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Permiso de cámara denegado. Actívalo en los ajustes del navegador para este sitio."
            : "No se pudo abrir la cámara. Usa la casilla de código manual abajo."
        );
      }
    }

    function loop() {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
          if (code?.data) handleDecoded(code.data);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    }

    start();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [handleDecoded]);

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) return;
    lastScanRef.current = null; // manual entry always re-checks, no cooldown
    submitToken(manualToken.trim());
    setManualToken("");
  }

  const selectedEvent = events.find((e) => e.id === eventId);
  const copy = outcome ? RESULT_COPY[outcome.kind] : null;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 40px", fontFamily: "-apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Escáner de entradas</h1>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 0 }}>Apunta al QR del correo de confirmación.</p>

      {/* Always-visible status: connection, offline data freshness, pending
          sync — the whole point is that staff can SEE the system is
          handling a dropped connection, not just hope it is. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <StatusPill
          label={isOnline ? "En línea" : "Sin conexión"}
          color={isOnline ? "#0e6b4c" : "#a3212b"}
          bg={isOnline ? "#e8f6ef" : "#fbe9ea"}
        />
        {pendingCount > 0 && (
          <StatusPill
            label={syncing ? `Sincronizando… (${pendingCount})` : `${pendingCount} sin sincronizar`}
            color="#8a5a1f"
            bg="#fdf1e6"
            onClick={syncQueue}
          />
        )}
      </div>

      {authError && (
        <p style={{ padding: 12, background: "#fbe9ea", color: "#a3212b", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          Tu sesión no se pudo confirmar con el servidor. Los escaneos se siguen guardando en este celular, pero
          avísale a un admin — puede que tu cuenta se haya desactivado, o que necesites volver a iniciar sesión
          cuando haya señal.
        </p>
      )}

      <div className="field">
        <label htmlFor="event">Evento (puerta)</label>
        <select id="event" value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">— Selecciona el evento —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} · {ev.city}
            </option>
          ))}
        </select>
      </div>

      {eventId && (
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: -8, marginBottom: 16 }}>
          {downloadingRoster
            ? "Descargando datos para modo sin conexión…"
            : roster
              ? `Datos sin conexión: ${roster.count} personas · descargados ${relativeTime(roster.downloadedAt)}`
              : "Sin datos descargados todavía para modo sin conexión — conéctate a internet antes de escanear sin señal."}{" "}
          <button type="button" onClick={() => downloadRoster(eventId)} style={linkButtonStyle} disabled={downloadingRoster}>
            Actualizar ahora
          </button>
        </p>
      )}

      <div className="field">
        <label htmlFor="label">Etiqueta de este dispositivo (opcional)</label>
        <input
          id="label"
          value={scannerLabel}
          placeholder="Puerta 1 - celular de Juan"
          onChange={(e) => {
            setScannerLabel(e.target.value);
            localStorage.setItem("nf_scan_label", e.target.value);
          }}
        />
      </div>

      {!eventId && (
        <p style={{ padding: 12, background: "#fff3cd", borderRadius: 8, fontSize: 14 }}>
          Selecciona un evento arriba antes de escanear — el escáner necesita saber para cuál puerta está validando.
        </p>
      )}

      <div style={{ position: "relative", background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "3 / 4" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", opacity: eventId ? 1 : 0.4 }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        {cameraError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: 20, color: "#fff", fontSize: 14, background: "rgba(0,0,0,0.7)" }}>
            {cameraError}
          </div>
        )}
      </div>

      {outcome && copy && (
        <div
          style={{
            marginTop: 16,
            padding: "20px 16px",
            borderRadius: 12,
            background: copy.color,
            color: "#fff",
            textAlign: "center",
          }}
        >
          {outcome.offline && (
            <div
              style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                background: "rgba(255,255,255,0.25)",
                padding: "3px 10px",
                borderRadius: 999,
                marginBottom: 8,
              }}
            >
              Sin conexión — pendiente de confirmar
            </div>
          )}
          <div style={{ fontSize: 40, lineHeight: 1 }}>{copy.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>{copy.label}</div>
          {outcome.personName && <div style={{ fontSize: 15, marginTop: 4 }}>{outcome.personName}</div>}
          {outcome.ticketTypeName && <div style={{ fontSize: 13, marginTop: 2, opacity: 0.9 }}>{outcome.ticketTypeName}</div>}
          {outcome.kind === "OFFLINE_UNKNOWN" && (
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
              No está en los datos descargados — puede ser un registro muy reciente. No lo rechaces solo por esto;
              apunta el nombre y verifica cuando vuelva la señal.
            </div>
          )}
          {outcome.kind === "WRONG_EVENT" && outcome.actualEventName && (
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>Su boleto es para: {outcome.actualEventName}</div>
          )}
          {outcome.kind === "VALID_REENTRY" && outcome.previousScanAt && (
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
              Primera entrada:{" "}
              {formatDateInTz(new Date(outcome.previousScanAt), { timeStyle: "short" }, timezone, language)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setOutcome(null)}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.25)", color: "#fff" }}
          >
            Escanear siguiente
          </button>
        </div>
      )}

      {checking && !outcome && <p style={{ marginTop: 12, fontSize: 14, color: "#5b5f6b" }}>Verificando…</p>}

      <details style={{ marginTop: 20 }}>
        <summary style={{ fontSize: 13, color: "#5b5f6b", cursor: "pointer" }}>
          La cámara no funciona — ingresar código manualmente
        </summary>
        <form onSubmit={submitManual} style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <input
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value)}
            placeholder="Pega el token del QR"
            style={{ flex: 1 }}
          />
          <button className="primary" type="submit" disabled={!eventId}>
            Verificar
          </button>
        </form>
      </details>

      {selectedEvent && (
        <p style={{ marginTop: 24, fontSize: 12, color: "#5b5f6b" }}>
          Validando contra: <strong>{selectedEvent.name}</strong>. Un boleto de otro evento se marca como &quot;Boleto de OTRO evento&quot;,
          no se acepta por error.
        </p>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function StatusPill({ label, color, bg, onClick }: { label: string; color: string; bg: string; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: bg,
        color,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {label}
    </span>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--link)",
  cursor: "pointer",
  fontSize: 12,
  padding: 0,
  textDecoration: "underline",
};
