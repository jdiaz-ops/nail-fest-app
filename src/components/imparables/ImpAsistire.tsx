"use client";

import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  asistireLayers,
  clampPlacement,
  drawAsistire,
  FIRST_PLACEMENT,
  LAYOUTS,
  MAX_ZOOM,
  photoBox,
  photoRect,
  type AsistireFonts,
  type AsistireFormat,
  type AsistireLayers,
  type AsistireTexts,
  type Placement,
} from "./asistireArt";

// «Asistiré» (2026-10-30), as in the boceto the team approved: her photo in,
// her image out — a story or a publication to share, and the link to book.
// Three steps on one page: she uploads her photo, adjusts it (dragging,
// pinching or with the slider) and shares or downloads the image. All of it
// happens in her browser (asistireArt.ts): her photo isn't sent anywhere.

interface Props {
  texts: AsistireTexts;
  fonts: AsistireFonts;
  /** The short link to paste in a story's link sticker: https://nailfest.lat/imparables */
  linkHref: string;
}

type Step = "subir" | "ajustar" | "lista";

const FORMATS: { id: AsistireFormat; name: string; ratio: string }[] = [
  { id: "historia", name: "Historia", ratio: "9:16" },
  { id: "publicacion", name: "Publicación", ratio: "4:5" },
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

export default function ImpAsistire({ texts, fonts, linkHref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layersRef = useRef<AsistireLayers | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>("subir");
  const [format, setFormat] = useState<AsistireFormat>("historia");
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [placement, setPlacement] = useState<Placement>(FIRST_PLACEMENT);
  const [moved, setMoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; file: File; canShare: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  // The faces and the logo first: the image is drawn with them.
  useEffect(() => {
    let gone = false;
    const logo = new Image();
    logo.src = "/logo.png";
    const faces = [`800 48px ${fonts.display}`, `900 98px ${fonts.display}`, `600 32px ${fonts.body}`, `800 32px ${fonts.body}`];
    Promise.allSettled([...faces.map((face) => document.fonts.load(face)), logo.decode()]).then(() => {
      if (gone) return;
      logoRef.current = logo.naturalWidth ? logo : null;
      setReady(true);
    });
    return () => {
      gone = true;
    };
  }, [fonts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!ready || !canvas) return;
    if (layersRef.current?.format !== format) layersRef.current = asistireLayers(format, texts, fonts, logoRef.current);
    drawAsistire(canvas.getContext("2d")!, layersRef.current, photo, placement, fonts);
  }, [ready, format, photo, placement, texts, fonts, step]);

  // On a computer, the wheel zooms her photo (a listener that may stop the page from scrolling).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || step !== "ajustar" || !photo) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setPlacement((p) => clampPlacement(photoBox(format), photo, { ...p, zoom: p.zoom * Math.exp(-e.deltaY / 500) }));
      setMoved(true);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [step, photo, format]);

  useEffect(() => () => void (result && URL.revokeObjectURL(result.url)), [result]);

  async function choose(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // So picking the same photo again still counts.
    e.target.value = "";
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const picture = await readPhoto(file);
      setPhoto(picture);
      setPlacement(clampPlacement(photoBox(format), picture, FIRST_PLACEMENT));
      setMoved(false);
      setStep("ajustar");
    } catch {
      setError("No pudimos abrir esa foto. Prueba con otra de tu galería (JPG o PNG).");
    } finally {
      setBusy(false);
    }
  }

  /** Moves her photo by a drag of dx, dy on the preview (screen pixels). */
  function move(dx: number, dy: number) {
    const canvas = canvasRef.current;
    if (!canvas || !photo) return;
    const k = canvas.width / canvas.getBoundingClientRect().width;
    const box = photoBox(format);
    setPlacement((p) => {
      const r = photoRect(box, photo, p);
      return clampPlacement(box, photo, { ...p, u: p.u - (dx * k) / r.w, v: p.v - (dy * k) / r.h });
    });
  }

  function zoomTo(zoom: number) {
    if (photo) setPlacement((p) => clampPlacement(photoBox(format), photo, { ...p, zoom }));
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (step !== "ajustar" || !photo) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const all = pointers.current;
    const before = all.get(e.pointerId);
    if (!before || !photo) return;
    if (all.size === 1) {
      move(e.clientX - before.x, e.clientY - before.y);
    } else {
      // Two fingers: as far apart as they get, that much bigger.
      const other = Array.from(all.entries()).find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const was = Math.hypot(before.x - other.x, before.y - other.y);
        const is = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (was > 0) setPlacement((p) => clampPlacement(photoBox(format), photo, { ...p, zoom: (p.zoom * is) / was }));
      }
    }
    all.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setMoved(true);
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(e.pointerId);
  }

  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] };
    const arrow = arrows[e.key];
    if (arrow) {
      e.preventDefault();
      move(arrow[0], arrow[1]);
    } else if (e.key === "+" || e.key === "=") {
      zoomTo(placement.zoom + 0.1);
    } else if (e.key === "-") {
      zoomTo(placement.zoom - 0.1);
    }
  }

  function pickFormat(next: AsistireFormat) {
    setFormat(next);
    if (photo) setPlacement((p) => clampPlacement(photoBox(next), photo, p));
  }

  async function finish() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    setBusy(false);
    if (!blob) {
      setError("No pudimos armar tu imagen. Intenta de nuevo.");
      return;
    }
    const file = new File([blob], `asistire-${format}.jpg`, { type: "image/jpeg" });
    setError(null);
    setResult({ url: URL.createObjectURL(blob), file, canShare: !!navigator.canShare?.({ files: [file] }) });
    setStep("lista");
    window.scrollTo({ top: 0 });
  }

  async function share() {
    if (!result) return;
    try {
      await navigator.share({ files: [result.file] });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("No se pudo abrir «Compartir». Descarga la imagen y súbela desde tu galería.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(linkHref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // The link stays in its field, selectable, to copy by hand.
    }
  }

  const L = LAYOUTS[format];
  const shape = `imp-as-vista${format === "publicacion" ? " is-post" : ""}`;
  const zoomShare = `${((placement.zoom - 1) / (MAX_ZOOM - 1)) * 100}%`;

  return (
    <div className="imp-as">
      {step === "subir" && (
        <>
          <h1 className="imp-co-h1">¡Cuéntale a todos que vas!</h1>
          <p className="imp-as-sub">Sube una foto tuya y te armamos tu imagen para historias y publicaciones.</p>
        </>
      )}
      {step === "ajustar" && (
        <>
          <h1 className="imp-co-h">
            <i>2</i>Ajusta tu foto
          </h1>
          <p className="imp-as-sub">Muévela con el dedo y acércala hasta que quede como te gusta.</p>
        </>
      )}
      {step === "lista" && (
        <h1 className="imp-co-h">
          <i>3</i>¡Quedó lista!
        </h1>
      )}

      {step === "lista" && result ? (
        <div className={shape}>
          {/* eslint-disable-next-line @next/next/no-img-element -- her own image, made in this browser */}
          <img src={result.url} alt="Tu imagen «¡Asistiré!», lista para compartir" />
        </div>
      ) : (
        <div className={`${shape}${step === "ajustar" ? " is-live" : ""}`}>
          <canvas
            ref={canvasRef}
            width={L.width}
            height={L.height}
            role="img"
            aria-label={photo ? "Tu imagen «¡Asistiré!»: arrastra para mover tu foto; con + y - cambias su tamaño" : "Así queda tu imagen «¡Asistiré!»"}
            tabIndex={step === "ajustar" ? 0 : -1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
          />
          {step === "ajustar" && !moved && (
            <span className="imp-as-mano" aria-hidden="true">
              <Arrows />
              Arrastra para moverla
            </span>
          )}
        </div>
      )}

      {step === "subir" && (
        <>
          <label className={`imp-co-btn imp-as-file${busy ? " is-busy" : ""}`}>
            <input type="file" accept="image/*" onChange={choose} disabled={busy} />
            <Camera />
            {busy ? "Abriendo tu foto…" : "Subir mi foto"}
          </label>
          <p className="imp-as-nota">
            <Lock />
            Tu foto se queda en tu celular: la imagen se arma ahí mismo, no la subimos a ningún lado.
          </p>
        </>
      )}

      {step === "ajustar" && (
        <>
          <div className="imp-as-zoom">
            <span>Tamaño</span>
            <button type="button" aria-label="Alejar la foto" onClick={() => zoomTo(placement.zoom - 0.2)}>
              −
            </button>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={placement.zoom}
              onChange={(e) => zoomTo(Number(e.target.value))}
              aria-label="Tamaño de la foto"
              style={{ "--p": zoomShare } as CSSProperties}
            />
            <button type="button" aria-label="Acercar la foto" onClick={() => zoomTo(placement.zoom + 0.2)}>
              +
            </button>
          </div>
          <div className="imp-as-seg" role="group" aria-label="Formato de la imagen">
            {FORMATS.map((f) => (
              <button key={f.id} type="button" className={format === f.id ? "is-on" : ""} aria-pressed={format === f.id} onClick={() => pickFormat(f.id)}>
                {f.name}
                <small>{f.ratio}</small>
              </button>
            ))}
          </div>
          <label className="imp-co-switch imp-as-otra">
            Cambiar foto
            <input type="file" accept="image/*" onChange={choose} disabled={busy} />
          </label>
          <button type="button" className="imp-co-btn" onClick={finish} disabled={busy}>
            {busy ? "Armando tu imagen…" : "Listo"}
          </button>
        </>
      )}

      {step === "lista" && result && (
        <>
          {result.canShare && (
            <button type="button" className="imp-co-btn" onClick={share}>
              <Share />
              Compartir
            </button>
          )}
          <a className={result.canShare ? "imp-as-btn2" : "imp-co-btn"} href={result.url} download={result.file.name}>
            <Download />
            Descargar imagen
          </a>
          <div className="imp-as-link">
            <strong>Pon el enlace en tu historia</strong>
            <div className="imp-as-copy">
              <input readOnly value={texts.link} aria-label="Enlace para reservar" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={copy}>
                {copied ? "¡Copiado!" : "Copiar"}
              </button>
            </div>
            <p>En Instagram usa el sticker «Enlace». En WhatsApp, pégalo en tu estado.</p>
          </div>
          <button type="button" className="imp-co-switch imp-as-otra" onClick={() => setStep("ajustar")}>
            Volver a ajustar
          </button>
        </>
      )}

      {error && (
        <p className="imp-as-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Camera() {
  return (
    <Icon>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.4-2h6.6l1.4 2h1.8A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
      <circle cx="12" cy="12.5" r="3.6" />
    </Icon>
  );
}

function Lock() {
  return (
    <Icon>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}

function Share() {
  return (
    <Icon>
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </Icon>
  );
}

function Download() {
  return (
    <Icon>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </Icon>
  );
}

function Arrows() {
  return (
    <Icon>
      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
    </Icon>
  );
}
