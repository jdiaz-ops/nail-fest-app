"use client";

import { useState } from "react";
import { youtubeId, type RecordingItem } from "@/lib/imparables/grabaciones";

// The rows of «Grabaciones»: each talk's title, who gives it, her Instagram (from the page, to correct) and its YouTube
// link — checked as it's pasted, with the video's picture once it's a real one —, rows to add or take out, the last
// day, and the save.
export default function RecordingsForm({
  eventId,
  initialItems,
  talks,
  initialUntil,
  defaultUntil,
  defaultUntilWords,
  opensWords,
  fromProgram,
}: {
  eventId: string;
  initialItems: RecordingItem[];
  /** The program's talks, to bring back the ones missing. */
  talks: RecordingItem[];
  initialUntil: string | null;
  /** "2027-08-03": 30 days after the congress. */
  defaultUntil: string;
  defaultUntilWords: string;
  /** "domingo 4 de julio": the congress's day. */
  opensWords: string;
  /** Nothing saved yet: the rows are the program's. */
  fromProgram: boolean;
}) {
  const [items, setItems] = useState<RecordingItem[]>(initialItems.length ? initialItems : [{ title: "", speaker: "", url: "" }]);
  const [until, setUntil] = useState(initialUntil ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const missing = talks.filter((talk) => !items.some((item) => item.title.trim() === talk.title && item.speaker.trim() === talk.speaker));
  const withVideo = items.filter((item) => youtubeId(item.url)).length;

  function change(i: number, field: keyof RecordingItem, value: string) {
    setItems((rows) => rows.map((row, j) => (j === i ? { ...row, [field]: value } : row)));
    setMessage(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const wrong = items.findIndex((item) => item.url.trim() && !youtubeId(item.url));
    if (wrong !== -1) {
      setMessage({ ok: false, text: `El enlace de la fila ${wrong + 1} no es de un video de YouTube. Cópialo otra vez desde YouTube.` });
      return;
    }
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/admin/events/${eventId}/recordings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ until: until || null, items }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) setMessage({ ok: true, text: "Guardado. Así las verá cada compradora en su página." });
    else if (res?.status === 400) setMessage({ ok: false, text: "Hay un enlace que no es de un video de YouTube. Revisa las filas en rojo." });
    else setMessage({ ok: false, text: "No se pudo guardar. Revisa tu conexión e intenta de nuevo." });
  }

  const cell = { display: "grid", gap: 4, fontSize: 12, fontWeight: 700, color: "#5b5f6b" } as const;

  return (
    <form onSubmit={save} style={{ maxWidth: 900 }}>
      {fromProgram && talks.length > 0 && (
        <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 12px" }}>
          Estas son las charlas de la agenda del evento. Cambia lo que quieras: así salen en la página de cada compradora.
        </p>
      )}

      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
        {items.map((item, i) => {
          const id = youtubeId(item.url);
          const wrong = Boolean(item.url.trim()) && !id;
          return (
            <li
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "auto minmax(0, 1fr)",
                gap: 12,
                alignItems: "start",
                padding: 12,
                border: `1px solid ${wrong ? "#e6a7a2" : "#e3e1dc"}`,
                borderRadius: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  width: 120,
                  aspectRatio: "16 / 9",
                  borderRadius: 8,
                  background: id ? `#000 url(https://i.ytimg.com/vi/${id}/mqdefault.jpg) center / cover` : "#f1efeb",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  color: "#8a8d96",
                }}
                aria-hidden="true"
              >
                {id ? "" : i + 1}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                  <label style={cell}>
                    Charla
                    <input value={item.title} onChange={(e) => change(i, "title", e.target.value)} placeholder="Cómo cobrar lo que vales" />
                  </label>
                  <label style={cell}>
                    Quién la da
                    <input value={item.speaker} onChange={(e) => change(i, "speaker", e.target.value)} placeholder="Nombre de la conferencista" />
                  </label>
                  <label style={cell}>
                    Su Instagram
                    <input value={item.handle ?? ""} onChange={(e) => change(i, "handle", e.target.value)} placeholder="@usuario" />
                  </label>
                </div>
                <label style={cell}>
                  Enlace de YouTube
                  <input
                    value={item.url}
                    onChange={(e) => change(i, "url", e.target.value)}
                    placeholder="https://youtu.be/…"
                    inputMode="url"
                    aria-invalid={wrong}
                    style={wrong ? { borderColor: "#c4453c" } : undefined}
                  />
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 13 }}>
                  {id ? (
                    <span style={{ color: "#0e6b4c", fontWeight: 700 }}>✓ Video de YouTube reconocido</span>
                  ) : wrong ? (
                    <span style={{ color: "#a3251f", fontWeight: 700 }}>Este enlace no es de un video de YouTube</span>
                  ) : (
                    <span style={{ color: "#8a8d96" }}>Sin enlace todavía: no se muestra</span>
                  )}
                  {id && (
                    <a href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">
                      Abrir en YouTube ↗
                    </a>
                  )}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setItems((rows) => rows.filter((_, j) => j !== i))}
                    style={{ width: "auto", padding: "4px 12px", fontSize: 13, marginLeft: "auto" }}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0 20px" }}>
        <button type="button" className="secondary" onClick={() => setItems((rows) => [...rows, { title: "", speaker: "", url: "", handle: "" }])} style={{ width: "auto", padding: "8px 16px" }}>
          + Agregar otra grabación
        </button>
        {missing.length > 0 && (
          <button type="button" className="secondary" onClick={() => setItems((rows) => [...rows, ...missing])} style={{ width: "auto", padding: "8px 16px" }}>
            Traer {missing.length === 1 ? "la charla que falta" : `las ${missing.length} charlas que faltan`} de la agenda
          </button>
        )}
      </div>

      <div style={{ padding: "14px 16px", border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff", maxWidth: 660 }}>
        <label htmlFor="rec-until" style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
          Disponibles hasta
        </label>
        <input id="rec-until" type="date" value={until || defaultUntil} onChange={(e) => setUntil(e.target.value === defaultUntil ? "" : e.target.value)} style={{ width: "auto" }} />
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "8px 0 0" }}>
          Aparecen al terminar el congreso, el {opensWords}, y se ven hasta el final del día que elijas. La boleta promete 30 días: hasta el {defaultUntilWords}.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginTop: 20 }}>
        <button type="submit" disabled={saving} style={{ width: "auto", padding: "10px 24px" }}>
          {saving ? "Guardando…" : "Guardar grabaciones"}
        </button>
        <span style={{ fontSize: 13, color: "#5b5f6b" }}>
          {withVideo} de {items.length} con video
        </span>
      </div>
      {message && <p style={{ fontSize: 14, margin: "10px 0 0", color: message.ok ? "#0e6b4c" : "#a3251f" }}>{message.text}</p>}
    </form>
  );
}
