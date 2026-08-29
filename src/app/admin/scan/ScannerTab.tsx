"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { formatDateInTz } from "@/lib/dateFormat";
import { useScanApp } from "./ScanAppContext";
import type { DisplayKind, DisplayOutcome } from "@/lib/useOfflineScanEngine";

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

export default function ScannerTab() {
  const { submitToken, timezone, language, authError } = useScanApp();

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [checking, setChecking] = useState(false);
  const [outcome, setOutcome] = useState<DisplayOutcome | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ token: string; at: number } | null>(null);
  const checkingRef = useRef(checking);
  checkingRef.current = checking;

  const submit = useCallback(
    async (token: string) => {
      setChecking(true);
      const result = await submitToken(token);
      setOutcome(result);
      setChecking(false);
    },
    [submitToken]
  );

  const handleDecoded = useCallback(
    (token: string) => {
      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.token === token && now - last.at < RESCAN_COOLDOWN_MS) return;
      if (checkingRef.current) return;
      lastScanRef.current = { token, at: now };
      submit(token);
    },
    [submit]
  );

  // Camera + decode loop.
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
    submit(manualToken.trim());
    setManualToken("");
  }

  const copy = outcome ? RESULT_COPY[outcome.kind] : null;

  return (
    <div>
      {authError && (
        <p style={{ padding: 12, background: "#fbe9ea", color: "#a3212b", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          Tu sesión no se pudo confirmar con el servidor. Los escaneos se siguen guardando en este celular, pero
          avísale a un admin — puede que tu cuenta se haya desactivado, o que necesites volver a iniciar sesión
          cuando haya señal.
        </p>
      )}

      <div style={{ position: "relative", background: "#000", borderRadius: 12, overflow: "hidden", aspectRatio: "3 / 4" }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
              Primera entrada: {formatDateInTz(new Date(outcome.previousScanAt), { timeStyle: "short" }, timezone, language)}
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
          <button className="primary" type="submit">
            Verificar
          </button>
        </form>
      </details>

      <p style={{ marginTop: 24, fontSize: 12, color: "#5b5f6b" }}>
        Un boleto de otro evento se marca como &quot;Boleto de OTRO evento&quot;, no se acepta por error. ¿Alguien
        no puede escanear su QR? Búscalo por nombre en la pestaña Lista.
      </p>
    </div>
  );
}
