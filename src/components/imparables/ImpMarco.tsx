"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react";
import { clampPlacement, FIRST_PLACEMENT, MAX_ZOOM, photoRect, type AsistireFonts, type Placement } from "./asistireArt";

// The profile frame of Manicuristas Imparables' kit (the team, 2026-11-04): her photo in a circle, ringed in
// chocolate and gold with «MANICURISTA IMPARABLE» over it and the congress's day under it — 1080×1080, to use on
// WhatsApp and Instagram, where the photo shows as a circle. She picks her photo, moves it with her finger and makes it
// bigger or smaller, and downloads it — no «Guardar o compartir» (the team, 2026-11-04: «dejar solo descargar»). All
// of it in her browser: her photo isn't sent anywhere.

const SIZE = 1080;
const C = SIZE / 2;
/** Her photo's circle, and the ring around it up to the circle a profile photo shows. */
const PHOTO_R = 436;
const RING_OUT = 528;
const BOX = { x: C - PHOTO_R, y: C - PHOTO_R, w: 2 * PHOTO_R, h: 2 * PHOTO_R };
const GOLD: [number, string][] = [
  [0, "#f0d9a6"],
  [0.38, "#d8b77a"],
  [0.62, "#c9a46a"],
  [1, "#a8844e"],
];

/** Her photo, upright, at most 2048 px on its longer side. */
async function readPhoto(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Words around the ring, upright: over it (reading left to right across the top) or under it (across the bottom). */
function arcText(ctx: CanvasRenderingContext2D, text: string, radius: number, side: "top" | "bottom", spacing: number) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let angle = side === "top" ? -Math.PI / 2 - total / radius / 2 : Math.PI / 2 + total / radius / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  chars.forEach((ch, i) => {
    const step = (widths[i]! - spacing) / 2 / radius;
    angle += side === "top" ? step : -step;
    ctx.save();
    ctx.translate(C + radius * Math.cos(angle), C + radius * Math.sin(angle));
    ctx.rotate(side === "top" ? angle + Math.PI / 2 : angle - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    angle += side === "top" ? step + spacing / radius : -(step + spacing / radius);
  });
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + d * Math.cos(a), y + d * Math.sin(a));
  }
  ctx.closePath();
  ctx.fill();
}

function drawMarco(ctx: CanvasRenderingContext2D, photo: HTMLCanvasElement | null, placement: Placement, fonts: AsistireFonts, texts: { top: string; bottom: string }) {
  const ground = ctx.createRadialGradient(C, C, PHOTO_R * 0.7, C, C, SIZE * 0.72);
  ground.addColorStop(0, "#5a4030");
  ground.addColorStop(1, "#24150d");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Her photo, or the waiting silhouette.
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, PHOTO_R, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    const r = photoRect(BOX, photo, placement);
    ctx.drawImage(photo, r.x, r.y, r.w, r.h);
  } else {
    ctx.fillStyle = "#e9dfcf";
    ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h);
    ctx.fillStyle = "#cbbba8";
    ctx.beginPath();
    ctx.arc(C, C - 70, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(C, C + 330, 300, 230, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const gold = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  for (const [at, color] of GOLD) gold.addColorStop(at, color);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(C, C, PHOTO_R + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(C, C, RING_OUT, 0, Math.PI * 2);
  ctx.stroke();

  // The words in the ring, and a star at each side between them.
  ctx.fillStyle = gold;
  ctx.font = `900 50px ${fonts.display}`;
  arcText(ctx, texts.top.toLocaleUpperCase("es"), 468, "top", 5);
  ctx.fillStyle = "#e6dacb";
  ctx.font = `800 31px ${fonts.body}`;
  arcText(ctx, texts.bottom.toLocaleUpperCase("es"), 497, "bottom", 7);
  ctx.fillStyle = gold;
  star(ctx, C - 485, C, 17);
  star(ctx, C + 485, C, 17);
}

export default function ImpMarco({ fonts, texts }: { fonts: AsistireFonts; texts: { top: string; bottom: string } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [placement, setPlacement] = useState<Placement>(FIRST_PLACEMENT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; file: File } | null>(null);

  useEffect(() => {
    let gone = false;
    Promise.allSettled([document.fonts.load(`900 50px ${fonts.display}`), document.fonts.load(`800 31px ${fonts.body}`)]).then(() => {
      if (!gone) setReady(true);
    });
    return () => {
      gone = true;
    };
  }, [fonts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (ready && canvas) drawMarco(canvas.getContext("2d")!, photo, placement, fonts, texts);
  }, [ready, photo, placement, fonts, texts]);

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const next = await readPhoto(file);
      setPhoto(next);
      setPlacement(clampPlacement(BOX, next, FIRST_PLACEMENT));
      setResult(null);
    } catch {
      setError("No pudimos abrir esa foto. Prueba con otra (JPG o PNG).");
    } finally {
      setBusy(false);
    }
  }

  function zoomTo(zoom: number) {
    if (!photo) return;
    setPlacement((p) => clampPlacement(BOX, photo, { ...p, zoom }));
    setResult(null);
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (!photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!photo || !drag.current) return;
    const k = SIZE / e.currentTarget.getBoundingClientRect().width;
    const dx = (e.clientX - drag.current.x) * k;
    const dy = (e.clientY - drag.current.y) * k;
    drag.current = { x: e.clientX, y: e.clientY };
    setPlacement((p) => {
      const r = photoRect(BOX, photo, p);
      return clampPlacement(BOX, photo, { ...p, u: p.u - dx / r.w, v: p.v - dy / r.h });
    });
    setResult(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!photo) return;
    const step = 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [du, dv] = moves[e.key]!;
      setPlacement((p) => clampPlacement(BOX, photo, { ...p, u: p.u + du, v: p.v + dv }));
    } else if (e.key === "+" || e.key === "=") {
      zoomTo(placement.zoom + 0.1);
    } else if (e.key === "-") {
      zoomTo(placement.zoom - 0.1);
    }
  }

  async function finish() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    setBusy(false);
    if (!blob) {
      setError("No pudimos armar tu foto. Intenta de nuevo.");
      return;
    }
    const file = new File([blob], "foto-perfil-imparable.png", { type: "image/png" });
    setResult({ url: URL.createObjectURL(blob), file });
  }

  return (
    <div className="imp-mf">
      <h1 className="imp-co-h1">Tu foto de perfil Imparable</h1>
      <p className="imp-as-sub">{photo ? "Muévela con el dedo y ajusta el tamaño hasta que quede como te gusta." : "Elige una foto tuya y la ponemos en el marco del congreso."}</p>

      <div className="imp-mf-vista">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={photo ? "Tu foto en el marco: arrastra para moverla; con + y - cambias su tamaño" : "Así queda el marco con tu foto"}
          tabIndex={photo ? 0 : -1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={onKeyDown}
        />
      </div>

      {photo && (
        <label className="imp-mf-zoom">
          <span>Tamaño</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={placement.zoom} onChange={(e) => zoomTo(Number(e.target.value))} />
        </label>
      )}

      {result ? (
        <div className="imp-mf-end">
          <a className="imp-co-btn" href={result.url} download={result.file.name}>
            Descargar mi foto
          </a>
          <p className="imp-mc-note">
            En WhatsApp: Ajustes → toca tu foto → Editar → elige esta imagen. En Instagram: Editar perfil → Cambiar foto.
          </p>
        </div>
      ) : (
        <div className="imp-mf-end">
          {photo && (
            <button type="button" className="imp-co-btn" onClick={finish} disabled={busy || !ready}>
              Listo, quiero mi foto
            </button>
          )}
          <label className={photo ? "imp-mc-btn2 imp-mf-file" : "imp-co-btn imp-mf-file"}>
            {busy ? "Abriendo tu foto…" : photo ? "Elegir otra foto" : "Elegir mi foto"}
            <input type="file" accept="image/*" onChange={choose} disabled={busy} />
          </label>
        </div>
      )}
      {error && (
        <p className="imp-mf-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
