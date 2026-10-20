"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { CUPONERA_SAVED_EVENT, mutedText } from "./ui";

// The page as visitors see it, next to the editors: on a phone (390 px, the
// default — that's where most of the visitors are) or on a computer (1280
// px, scaled down to fit). It reloads by itself after every save in the
// editors (ui.tsx announces them) and keeps the scroll where it was.

// ?vista=admin: the page leaves out its "Vista previa del equipo" banner.
const PREVIEW_URL = "/cuponera?vista=admin";
const PHONE_WIDTH = 390;
const PHONE_HEIGHT = 844;
const PHONE_BEZEL = 10;
const WEB_WIDTH = 1280;
const WEB_BAR = 30;
// A burst of saves (a brand moved twice in a row) reloads once.
const RELOAD_DELAY_MS = 400;

type Mode = "celular" | "web";

const segmentStyle = (on: boolean): CSSProperties => ({
  padding: "6px 14px",
  border: "none",
  borderRadius: 999,
  background: on ? "#17181c" : "transparent",
  color: on ? "#fff" : "#17181c",
  fontSize: 13,
  fontWeight: on ? 700 : 500,
  cursor: "pointer",
});

export default function CuponeraPreview() {
  const [mode, setMode] = useState<Mode>("celular");
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const areaRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const scrollToRestore = useRef<number | null>(null);

  // The frame can finish loading before this component hydrates — then
  // onLoad never fires for that first load.
  useEffect(() => {
    try {
      const doc = frameRef.current?.contentDocument;
      if (doc && doc.readyState === "complete" && doc.location.href !== "about:blank") setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setArea({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reload = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    setLoading(true);
    try {
      // Same origin, so the frame's scroll and address are reachable. Back
      // to the cuponera even if a link inside took the frame elsewhere.
      scrollToRestore.current = frame.contentWindow?.scrollY ?? 0;
      frame.contentWindow?.location.replace(PREVIEW_URL);
    } catch {
      frame.src = PREVIEW_URL;
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSaved = () => {
      clearTimeout(timer);
      timer = setTimeout(reload, RELOAD_DELAY_MS);
    };
    window.addEventListener(CUPONERA_SAVED_EVENT, onSaved);
    return () => {
      window.removeEventListener(CUPONERA_SAVED_EVENT, onSaved);
      clearTimeout(timer);
    };
  }, [reload]);

  function onLoad() {
    setLoading(false);
    const y = scrollToRestore.current;
    scrollToRestore.current = null;
    if (!y) return;
    try {
      frameRef.current?.contentWindow?.scrollTo(0, y);
    } catch {
      // Not reachable (shouldn't happen on the same origin): it stays at the top.
    }
  }

  const phone = mode === "celular";
  const phoneHeight = Math.max(360, Math.min(PHONE_HEIGHT, area.height - 2 * PHONE_BEZEL));
  // The computer view: the page laid out at 1280 px, shown at the column's width.
  const webWidth = Math.max(0, area.width - 2);
  const webScale = webWidth > 0 ? Math.min(1, webWidth / WEB_WIDTH) : 0.5;
  const webHeight = Math.max(240, area.height - WEB_BAR - 2);

  // One iframe in the same spot for both modes: switching only changes its
  // size, so the page doesn't reload.
  const frameStyle: CSSProperties = phone
    ? { padding: PHONE_BEZEL, borderRadius: 48, background: "#17181c", boxShadow: "0 14px 34px rgba(23, 24, 28, 0.18)" }
    : { width: area.width, border: "1px solid #e3e1dc", borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 10px 28px rgba(23, 24, 28, 0.1)" };
  const screenStyle: CSSProperties = phone
    ? { width: PHONE_WIDTH, height: phoneHeight, borderRadius: 38, overflow: "hidden", background: "#fff" }
    : { width: webWidth, height: webHeight, overflow: "hidden" };
  const iframeStyle: CSSProperties = phone
    ? { display: "block", width: PHONE_WIDTH, height: phoneHeight, border: 0 }
    : { display: "block", width: WEB_WIDTH, height: webHeight / webScale, border: 0, transform: `scale(${webScale})`, transformOrigin: "0 0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 160px", minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Vista previa</div>
          <div style={{ ...mutedText, fontSize: 12 }} aria-live="polite">
            {loading ? "Actualizando…" : "Se actualiza sola cada vez que guardas un cambio."}
          </div>
        </div>
        <div role="group" aria-label="Ver como" style={{ display: "flex", padding: 3, border: "1px solid #e3e1dc", borderRadius: 999, background: "#fff" }}>
          <button type="button" aria-pressed={phone} onClick={() => setMode("celular")} style={segmentStyle(phone)}>
            Celular
          </button>
          <button type="button" aria-pressed={!phone} onClick={() => setMode("web")} style={segmentStyle(!phone)}>
            Web
          </button>
        </div>
        <button
          type="button"
          onClick={reload}
          title="Recargar la vista previa"
          aria-label="Recargar la vista previa"
          style={{ width: 34, height: 34, border: "1px solid #e3e1dc", borderRadius: "50%", background: "#fff", fontSize: 16, lineHeight: 1, cursor: "pointer" }}
        >
          ↻
        </button>
        <a href="/cuponera" target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
          Abrir ↗
        </a>
      </div>

      <div ref={areaRef} style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", overflow: "hidden" }}>
        <div style={frameStyle}>
          {!phone && (
            <div
              aria-hidden="true"
              style={{
                height: WEB_BAR,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 12px",
                background: "#f3f1ee",
                borderBottom: "1px solid #e3e1dc",
                fontSize: 12,
                color: "#5b5f6b",
                boxSizing: "border-box",
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e3a19b" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#e8cf8f" }} />
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#a9d3a0" }} />
              <span style={{ marginLeft: 8 }}>nailfest.lat/cuponera</span>
            </div>
          )}
          <div style={screenStyle}>
            <iframe ref={frameRef} src={PREVIEW_URL} title="Vista previa de la cuponera" onLoad={onLoad} style={iframeStyle} />
          </div>
        </div>
      </div>
    </div>
  );
}
