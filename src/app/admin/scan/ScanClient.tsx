"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { formatDateInTz } from "@/lib/dateFormat";

interface EventOption {
  id: string;
  slug: string;
  name: string;
  city: string;
  startsAt: string;
}

interface ScanApiResult {
  result: "VALID_FIRST" | "VALID_REENTRY" | "WRONG_EVENT" | "INVALID_TOKEN" | "NOT_FOUND";
  personName?: string;
  eventName?: string;
  actualEventName?: string;
  previousScanAt?: string;
}

const RESULT_COPY: Record<ScanApiResult["result"], { emoji: string; label: string; color: string }> = {
  VALID_FIRST: { emoji: "✅", label: "Entrada válida", color: "#1f7a5c" },
  VALID_REENTRY: { emoji: "🔁", label: "Reingreso — ya había entrado", color: "#b8791a" },
  WRONG_EVENT: { emoji: "⚠️", label: "Boleto de OTRO evento", color: "#b8791a" },
  INVALID_TOKEN: { emoji: "❌", label: "Código inválido", color: "#c2185b" },
  NOT_FOUND: { emoji: "❌", label: "No existe ese registro", color: "#c2185b" },
};

// Same-token re-scans while the QR is still sitting in frame shouldn't fire
// the API twice — the decode loop runs many times a second.
const RESCAN_COOLDOWN_MS = 2500;

export default function ScanClient({ events, timezone, language }: { events: EventOption[]; timezone: string; language: string }) {
  const [eventId, setEventId] = useState<string>("");
  const [scannerLabel, setScannerLabel] = useState<string>("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<ScanApiResult | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);
  // Avoids a stale closure over `eventId`/`checking` inside the rAF loop,
  // which is set up once and would otherwise keep seeing their initial values.
  const eventIdRef = useRef(eventId);
  const checkingRef = useRef(checking);

  useEffect(() => {
    const saved = localStorage.getItem("nf_scan_event");
    if (saved) setEventId(saved);
    const savedLabel = localStorage.getItem("nf_scan_label");
    if (savedLabel) setScannerLabel(savedLabel);
  }, []);

  useEffect(() => {
    eventIdRef.current = eventId;
    if (eventId) localStorage.setItem("nf_scan_event", eventId);
  }, [eventId]);

  useEffect(() => {
    checkingRef.current = checking;
  }, [checking]);

  const submitToken = useCallback(async (token: string) => {
    if (!eventIdRef.current) return;
    setChecking(true);
    checkingRef.current = true;
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, eventId: eventIdRef.current, scannerLabel: scannerLabel || undefined }),
      });
      const data: ScanApiResult = await res.json();
      setOutcome(data);
    } catch {
      setOutcome({ result: "INVALID_TOKEN" });
    } finally {
      setChecking(false);
      checkingRef.current = false;
    }
  }, [scannerLabel]);

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
  const copy = outcome ? RESULT_COPY[outcome.result] : null;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: "16px 16px 40px", fontFamily: "-apple-system, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Escáner de entradas</h1>
      <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: 0 }}>MVP — apunta al QR del correo de confirmación.</p>

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
          <div style={{ fontSize: 40, lineHeight: 1 }}>{copy.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginTop: 8 }}>{copy.label}</div>
          {outcome.personName && <div style={{ fontSize: 15, marginTop: 4 }}>{outcome.personName}</div>}
          {outcome.result === "WRONG_EVENT" && outcome.actualEventName && (
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>Su boleto es para: {outcome.actualEventName}</div>
          )}
          {outcome.result === "VALID_REENTRY" && outcome.previousScanAt && (
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
