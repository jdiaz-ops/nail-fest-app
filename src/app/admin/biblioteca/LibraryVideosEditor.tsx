"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminCuponeraProduct, AdminInstructor, AdminVideo } from "@/lib/library/admin";
import { scoreFields } from "@/lib/library/search";
import {
  LIBRARY_LEVELS,
  LIBRARY_THEMES,
  formatDuration,
  formatViews,
  isLevel,
  isTheme,
  levelLabel,
  queryWords,
  themeOf,
  youtubeIdFrom,
  youtubeThumbnail,
  type UsedProductRef,
} from "@/lib/library/shared";
import { api, CardTitle, cardStyle, IconButton, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle, Switch } from "../cuponera/ui";
import { Check, FormError, Sheet, linesOf, rowStyle, twoColumns } from "./ui";

interface Draft {
  kind: "video" | "maraton";
  title: string;
  youtube: string;
  duration: string;
  theme: string;
  level: string;
  instructorId: string;
  teachersNote: string;
  description: string;
  products: UsedProductRef[];
  steps: string;
  gated: boolean;
  visible: boolean;
  inShorties: boolean;
}

const EMPTY: Draft = {
  kind: "video",
  title: "",
  youtube: "",
  duration: "",
  theme: "tecnicas",
  level: "principiante",
  instructorId: "",
  teachersNote: "",
  description: "",
  products: [],
  steps: "",
  gated: false,
  visible: true,
  inShorties: true,
};

function draftOf(v: AdminVideo): Draft {
  return {
    kind: v.kind === "maraton" ? "maraton" : "video",
    title: v.title,
    youtube: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    duration: v.durationSeconds != null ? formatDuration(v.durationSeconds) : "",
    theme: v.theme,
    level: v.level,
    instructorId: v.instructorId ?? "",
    teachersNote: v.teachersNote ?? "",
    description: v.description ?? "",
    products: v.products,
    steps: v.steps.join("\n"),
    gated: v.gated,
    visible: v.visible,
    inShorties: v.inShorties,
  };
}

// Editar biblioteca → Videos: the short videos and the marathons'
// recordings, each a YouTube video (public or unlisted) with its theme,
// level, instructor, "Lo que usó" (from the cuponera, or written by hand)
// and its step by step.
export default function LibraryVideosEditor({
  videos,
  instructors,
  products,
}: {
  videos: AdminVideo[];
  instructors: AdminInstructor[];
  products: AdminCuponeraProduct[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setVisible(video: AdminVideo, visible: boolean) {
    setBusyId(video.id);
    setError(null);
    try {
      await api(`/api/admin/library/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ visible }) });
      router.refresh();
    } catch {
      setError("No se pudo cambiar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(video: AdminVideo) {
    if (!confirm(`¿Eliminar «${video.title}» de la biblioteca? Si solo quieres que no se vea, mejor apágalo.`)) return;
    setBusyId(video.id);
    setError(null);
    try {
      await api(`/api/admin/library/videos/${video.id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setError("No se pudo eliminar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={cardStyle}>
      <CardTitle
        aside={
          <button type="button" style={primaryButtonStyle} onClick={() => setEditing({ id: null, draft: EMPTY })}>
            Nuevo video
          </button>
        }
      >
        Videos y grabaciones
      </CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Cada video vive en YouTube (público o «no listado») y se ve en nailfest.lat/biblioteca. Los cortos son verticales; las grabaciones de las
        maratones, horizontales y con registro gratis. El switch lo muestra u oculta sin borrarlo.
      </p>
      {error && <FormError>{error}</FormError>}

      {videos.length === 0 ? (
        <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>
          Todavía no hay videos. Mientras tanto, el equipo ve ejemplos inventados en la biblioteca.
        </p>
      ) : (
        videos.map((v) => {
          const theme = isTheme(v.theme) ? themeOf(v.theme).label : v.theme;
          const level = isLevel(v.level) ? levelLabel(v.level) : v.level;
          const meta = [theme, level, v.instructorName ?? v.teachersNote, v.durationSeconds != null ? formatDuration(v.durationSeconds) : null, v.views > 0 ? formatViews(v.views) : null];
          return (
            <div key={v.id} style={{ ...rowStyle, opacity: v.visible ? 1 : 0.6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's still */}
              <img
                src={youtubeThumbnail(v.youtubeId)}
                alt=""
                width={v.kind === "maraton" ? 96 : 54}
                height={v.kind === "maraton" ? 54 : 96}
                style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "#f0efec" }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{v.title}</div>
                <div style={{ ...mutedText, fontSize: 12 }}>{meta.filter(Boolean).join(" · ")}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {v.kind === "maraton" && <Pill tone="grey">Grabación</Pill>}
                  {v.gated && <Pill tone="amber">Con registro</Pill>}
                  {v.kind === "video" && !v.inShorties && <Pill tone="grey">Fuera de Shorties</Pill>}
                  {v.products.length > 0 && <Pill tone="green">{v.products.length === 1 ? "1 producto" : `${v.products.length} productos`}</Pill>}
                  {!v.visible && <Pill tone="red">Oculto</Pill>}
                </div>
              </div>
              <a href={`/biblioteca/${v.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }} title="Ver en la biblioteca">
                Ver ↗
              </a>
              <Switch checked={v.visible} disabled={busyId === v.id} label={v.visible ? "Visible" : "Oculto"} onChange={(next) => setVisible(v, next)} />
              <IconButton title="Editar" onClick={() => setEditing({ id: v.id, draft: draftOf(v) })}>
                ✏️
              </IconButton>
              <IconButton title="Eliminar" disabled={busyId === v.id} onClick={() => remove(v)}>
                🗑️
              </IconButton>
            </div>
          );
        })
      )}

      {editing && (
        <VideoForm
          id={editing.id}
          initial={editing.draft}
          instructors={instructors}
          products={products}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function VideoForm({
  id,
  initial,
  instructors,
  products,
  onClose,
  onSaved,
}: {
  id: string | null;
  initial: Draft;
  instructors: AdminInstructor[];
  products: AdminCuponeraProduct[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState({ brand: "", name: "" });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));
  const youtubeId = youtubeIdFrom(d.youtube);

  const matches = useMemo(() => {
    const words = queryWords(search);
    if (!words.length) return [];
    return products
      .map((p) => ({ p, score: scoreFields([{ text: p.name, weight: 3 }, { text: p.brand, weight: 2 }], words) }))
      .filter((m) => m.score > 0 && !d.products.some((x) => x.cuponeraProductId === m.p.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((m) => m.p);
  }, [search, products, d.products]);

  const move = (index: number, by: number) => {
    const list = [...d.products];
    const [item] = list.splice(index, 1);
    list.splice(Math.max(0, Math.min(list.length, index + by)), 0, item!);
    set("products", list);
  };

  async function save() {
    if (d.title.trim().length < 3) return setMessage("Escribe el título (al menos 3 letras).");
    if (!youtubeId) return setMessage("El link de YouTube no es válido. Pega el link del video (o de su Short).");
    setSaving(true);
    setMessage(null);
    const body = {
      kind: d.kind,
      title: d.title,
      youtube: d.youtube,
      duration: d.duration || null,
      theme: d.theme,
      level: d.level,
      instructorId: d.instructorId || null,
      teachersNote: d.kind === "maraton" ? d.teachersNote || null : null,
      description: d.description || null,
      products: d.products,
      steps: linesOf(d.steps),
      gated: d.gated,
      visible: d.visible,
      inShorties: d.inShorties,
    };
    try {
      await api(id ? `/api/admin/library/videos/${id}` : "/api/admin/library/videos", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setMessage(
        e instanceof Error && e.message === "invalid_body" ? "Revisa los datos: la duración va como 0:48 y cada paso en su propia línea." : "No se pudo guardar. Vuelve a intentarlo.",
      );
      setSaving(false);
    }
  }

  return (
    <Sheet title={id ? "Editar video" : "Nuevo video"} onClose={onClose}>
      <div className="field">
        <label>Tipo</label>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {(
            [
              ["video", "Video corto (vertical)"],
              ["maraton", "Grabación de maratón (horizontal)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14, fontWeight: 500, color: "#17181c" }}>
              <input
                type="radio"
                name="video-kind"
                checked={d.kind === value}
                onChange={() => setD((x) => ({ ...x, kind: value, gated: id ? x.gated : value === "maraton" }))}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="video-title">Título</label>
        <input id="video-title" value={d.title} maxLength={140} placeholder="Francesa invertida con cromo" onChange={(e) => set("title", e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="video-youtube">Link de YouTube</label>
          <input id="video-youtube" value={d.youtube} placeholder="https://youtube.com/shorts/…" onChange={(e) => set("youtube", e.target.value)} />
          <span style={{ ...mutedText, fontSize: 12 }}>
            {d.youtube && !youtubeId ? "No reconocemos ese link como un video de YouTube." : "Público o «no listado» en el canal de Nail Fest."}
          </span>
        </div>
        {youtubeId && (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube's still
          <img src={youtubeThumbnail(youtubeId)} alt="" width={96} height={72} style={{ objectFit: "cover", borderRadius: 8, marginTop: 22 }} />
        )}
      </div>
      <div style={twoColumns}>
        <div className="field">
          <label htmlFor="video-theme">Tema</label>
          <select id="video-theme" value={d.theme} onChange={(e) => set("theme", e.target.value)}>
            {LIBRARY_THEMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="video-level">Nivel</label>
          <select id="video-level" value={d.level} onChange={(e) => set("level", e.target.value)}>
            {LIBRARY_LEVELS.map((l) => (
              <option key={l.key} value={l.key}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="video-instructor">Instructora</label>
          <select id="video-instructor" value={d.instructorId} onChange={(e) => set("instructorId", e.target.value)}>
            <option value="">Sin instructora</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.city}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="video-duration">Duración</label>
          <input id="video-duration" value={d.duration} placeholder={d.kind === "maraton" ? "2:30:00" : "0:48"} maxLength={12} onChange={(e) => set("duration", e.target.value)} />
        </div>
      </div>
      {d.kind === "maraton" && (
        <div className="field">
          <label htmlFor="video-teachers">Quiénes enseñan</label>
          <input id="video-teachers" value={d.teachersNote} maxLength={80} placeholder="4 instructoras" onChange={(e) => set("teachersNote", e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="video-description">Descripción corta</label>
        <textarea id="video-description" rows={3} value={d.description} maxLength={1000} onChange={(e) => set("description", e.target.value)} />
      </div>

      <div className="field">
        <label>Lo que usó</label>
        {d.products.length === 0 && <span style={{ ...mutedText, fontSize: 12 }}>Sin productos todavía.</span>}
        {d.products.map((p, index) => (
          <div key={`${p.cuponeraProductId ?? "manual"}-${index}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid #e3e1dc", borderRadius: 8 }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 14 }}>
              <b>{p.name}</b>
              <span style={{ ...mutedText, fontSize: 12 }}>
                {p.brand ? ` · ${p.brand}` : ""} · {p.cuponeraProductId ? "de la cuponera" : "escrito a mano"}
              </span>
            </span>
            <IconButton title="Subir" disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </IconButton>
            <IconButton title="Bajar" disabled={index === d.products.length - 1} onClick={() => move(index, 1)}>
              ↓
            </IconButton>
            <IconButton title="Quitar" onClick={() => set("products", d.products.filter((_, i) => i !== index))}>
              ✕
            </IconButton>
          </div>
        ))}
        <input
          value={search}
          placeholder={products.length ? "Busca un producto de la cuponera para agregarlo" : "La cuponera todavía no tiene productos"}
          disabled={products.length === 0}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginTop: 6 }}
        />
        {matches.length > 0 && (
          <div style={{ border: "1px solid #e3e1dc", borderRadius: 8, overflow: "hidden" }}>
            {matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  set("products", [...d.products, { cuponeraProductId: p.id, brand: p.brand, name: p.name }]);
                  setSearch("");
                }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", borderTop: "1px solid #efece7", background: "#fff", cursor: "pointer", fontSize: 13 }}
              >
                <b>{p.name}</b> · {p.brand}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
          <input value={manual.brand} placeholder="Marca" maxLength={80} onChange={(e) => setManual((m) => ({ ...m, brand: e.target.value }))} style={{ flex: "1 1 120px" }} />
          <input value={manual.name} placeholder="Producto (no está en la cuponera)" maxLength={160} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} style={{ flex: "2 1 200px" }} />
          <button
            type="button"
            style={secondaryButtonStyle}
            disabled={!manual.name.trim()}
            onClick={() => {
              set("products", [...d.products, { cuponeraProductId: null, brand: manual.brand.trim(), name: manual.name.trim() }]);
              setManual({ brand: "", name: "" });
            }}
          >
            Agregar a mano
          </button>
        </div>
        <span style={{ ...mutedText, fontSize: 12 }}>Los de la cuponera salen con su descuento, el código y el botón «Comprar».</span>
      </div>

      <div className="field">
        <label htmlFor="video-steps">El paso a paso (un paso por línea)</label>
        <textarea
          id="video-steps"
          rows={5}
          value={d.steps}
          placeholder={"Prepara la uña y aplica la base.\nDibuja la línea con un pincel fino.\nRellena y cura."}
          onChange={(e) => set("steps", e.target.value)}
        />
      </div>
      <Check checked={d.gated} onChange={(v) => set("gated", v)} label="Pide registro gratis para verlo" hint="El video se ve después de dejar nombre y correo (lo normal en las grabaciones)." />
      <Check checked={d.visible} onChange={(v) => set("visible", v)} label="Visible en la biblioteca" />
      {d.kind === "video" && (
        <Check
          checked={d.inShorties}
          onChange={(v) => set("inShorties", v)}
          label="Mostrar en Shorties"
          hint="Sale en nailfest.lat/biblioteca/shorties, los videos cortos al azar uno tras otro."
        />
      )}
      {message && <FormError>{message}</FormError>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" style={secondaryButtonStyle} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" style={primaryButtonStyle} disabled={saving} onClick={save}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Sheet>
  );
}
