"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { AdminCuponeraProduct, AdminInstructor, AdminSubcategory, AdminVideo } from "@/lib/library/admin";
import { scoreFields } from "@/lib/library/search";
import {
  EXTRA_THEMES_UP_TO,
  LIBRARY_THEMES,
  VIDEO_TAGS_UP_TO,
  VIDEO_TAG_SUGGESTIONS,
  formatDuration,
  formatViews,
  isTheme,
  queryWords,
  themeOf,
  youtubeIdFrom,
  youtubeThumbnail,
  type UsedProductRef,
} from "@/lib/library/shared";
import { api, CardTitle, cardStyle, IconButton, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle, Switch } from "../cuponera/ui";
import { Check, FormError, Sheet, TagPicker, linesOf, rowStyle, twoColumns } from "./ui";

interface Draft {
  kind: "video" | "maraton";
  title: string;
  youtube: string;
  duration: string;
  theme: string;
  extraThemes: string[];
  /** Its subcategory's key; "" for none. */
  subcategory: string;
  instructorId: string;
  teachersNote: string;
  description: string;
  products: UsedProductRef[];
  steps: string;
  gated: boolean;
  visible: boolean;
  inShorties: boolean;
  tags: string[];
}

const EMPTY: Draft = {
  kind: "video",
  title: "",
  youtube: "",
  duration: "",
  theme: "tecnicas",
  extraThemes: [],
  subcategory: "",
  instructorId: "",
  teachersNote: "",
  description: "",
  products: [],
  steps: "",
  gated: false,
  visible: true,
  inShorties: true,
  tags: [],
};

function draftOf(v: AdminVideo): Draft {
  return {
    kind: v.kind === "maraton" ? "maraton" : "video",
    title: v.title,
    youtube: `https://www.youtube.com/watch?v=${v.youtubeId}`,
    duration: v.durationSeconds != null ? formatDuration(v.durationSeconds) : "",
    theme: v.theme,
    extraThemes: v.extraThemes,
    subcategory: v.subcategories[0] ?? "",
    instructorId: v.instructorId ?? "",
    teachersNote: v.teachersNote ?? "",
    description: v.description ?? "",
    products: v.products,
    steps: v.steps.join("\n"),
    gated: v.gated,
    visible: v.visible,
    inShorties: v.inShorties,
    tags: v.tags,
  };
}

const themeLabel = (key: string) => (isTheme(key) ? themeOf(key).label : key);
const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;
const PAGE = 50;

const ORIGINS = { ia: "La IA, desde YouTube", equipo: "El equipo", instructora: "Una instructora" } as const;
const KINDS = { cortos: "Cortos", videos: "Videos largos", grabaciones: "Grabaciones" } as const;

const control: CSSProperties = { padding: "7px 10px", border: "1px solid #e3e1dc", borderRadius: 8, fontSize: 13, background: "#fff", color: "#17181c" };
const chip = (on: boolean): CSSProperties => ({
  padding: "5px 11px",
  borderRadius: 999,
  border: `1px solid ${on ? "#17181c" : "#e3e1dc"}`,
  background: on ? "#17181c" : "#fff",
  color: on ? "#fff" : "#17181c",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
});
const linkButton: CSSProperties = { border: "none", background: "none", padding: 0, color: "#0d6e4f", fontSize: 12, fontWeight: 600, cursor: "pointer" };

/** What the server gives back on a delete, to undo it. */
type Restore = Record<string, unknown>;

/** The subcategories to choose from, by theme. */
function SubcategoryOptions({ subcategories }: { subcategories: AdminSubcategory[] }) {
  return (
    <>
      {LIBRARY_THEMES.map((t) => {
        const subs = subcategories.filter((s) => s.theme === t.key && !s.hidden);
        return subs.length ? (
          <optgroup key={t.key} label={t.label}>
            {subs.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </>
  );
}

/** A main theme, up to two more, and the subcategory — the main one can't also be another. */
function ThemeFields({
  idPrefix,
  theme,
  extraThemes,
  subcategory,
  subcategories,
  onChange,
}: {
  idPrefix: string;
  theme: string;
  extraThemes: string[];
  subcategory: string;
  subcategories: AdminSubcategory[];
  onChange: (next: { theme: string; extraThemes: string[]; subcategory: string }) => void;
}) {
  const toggle = (key: string) => {
    const on = extraThemes.includes(key);
    if (!on && extraThemes.length >= EXTRA_THEMES_UP_TO) return;
    onChange({ theme, extraThemes: on ? extraThemes.filter((t) => t !== key) : [...extraThemes, key], subcategory });
  };
  const chooseSubcategory = (key: string) => {
    const sub = subcategories.find((s) => s.key === key);
    // Its theme comes along when it isn't one of the video's.
    let extra = extraThemes;
    if (sub && sub.theme !== theme && !extra.includes(sub.theme)) extra = [...extra, sub.theme].slice(-EXTRA_THEMES_UP_TO);
    onChange({ theme, extraThemes: extra, subcategory: key });
  };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`${idPrefix}-theme`}>Tema principal</label>
        <select
          id={`${idPrefix}-theme`}
          style={control}
          value={theme}
          onChange={(e) => onChange({ theme: e.target.value, extraThemes: extraThemes.filter((t) => t !== e.target.value), subcategory })}
        >
          {LIBRARY_THEMES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#5b5f6b", marginBottom: 6 }}>También en (hasta {EXTRA_THEMES_UP_TO})</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {LIBRARY_THEMES.filter((t) => t.key !== theme).map((t) => (
            <button key={t.key} type="button" aria-pressed={extraThemes.includes(t.key)} style={chip(extraThemes.includes(t.key))} onClick={() => toggle(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="field" style={{ margin: 0 }}>
        <label htmlFor={`${idPrefix}-sub`}>Subcategoría</label>
        <select id={`${idPrefix}-sub`} style={control} value={subcategory} onChange={(e) => chooseSubcategory(e.target.value)}>
          <option value="">Ninguna</option>
          <SubcategoryOptions subcategories={subcategories} />
        </select>
      </div>
    </div>
  );
}

/** Under a video's row: its themes and subcategory, saved on each tap. */
function QuickThemes({ video, subcategories, onSaved }: { video: AdminVideo; subcategories: AdminSubcategory[]; onSaved: () => void }) {
  const [value, setValue] = useState({ theme: video.theme, extraThemes: video.extraThemes, subcategory: video.subcategories[0] ?? "" });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [newName, setNewName] = useState("");

  async function save(next: typeof value) {
    setValue(next);
    setState("saving");
    try {
      await api(`/api/admin/library/videos/${video.id}`, {
        method: "PATCH",
        body: JSON.stringify({ theme: next.theme, extraThemes: next.extraThemes, subcategories: next.subcategory ? [next.subcategory] : [] }),
      });
      setState("saved");
      onSaved();
    } catch {
      setState("error");
    }
  }

  async function createAndChoose() {
    const name = newName.trim();
    if (name.length < 2) return;
    setState("saving");
    try {
      const { subcategory } = await api<{ subcategory: { key: string } }>("/api/admin/library/subcategories", {
        method: "POST",
        body: JSON.stringify({ name, theme: value.theme }),
      });
      setNewName("");
      await save({ ...value, subcategory: subcategory.key });
    } catch {
      setState("error");
    }
  }

  return (
    <div style={{ margin: "8px 0 4px", padding: 12, background: "#faf9f7", border: "1px solid #efece7", borderRadius: 10 }} aria-label={`Temas de «${video.title}»`}>
      <ThemeFields idPrefix={`q-${video.id}`} {...value} subcategories={subcategories} onChange={(next) => void save(next)} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
        <input
          aria-label="Nueva subcategoría"
          style={{ ...control, flex: "1 1 180px" }}
          value={newName}
          maxLength={40}
          placeholder={`Nueva subcategoría en ${themeLabel(value.theme)}`}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="button" style={secondaryButtonStyle} disabled={newName.trim().length < 2 || state === "saving"} onClick={createAndChoose}>
          Crear y elegir
        </button>
        <span style={{ fontSize: 12, color: state === "error" ? "#b0225c" : "#12966b" }} role="status">
          {state === "saving" ? "Guardando…" : state === "saved" ? "Guardado" : state === "error" ? "No se pudo guardar. Vuelve a intentarlo." : ""}
        </span>
      </div>
    </div>
  );
}

// Editar biblioteca → Videos: every video in the library — the ones the
// autopilot published from YouTube, the team's and the instructors' —, to
// find by words, theme, subcategory, kind or who put it in, and to fix in
// one tap: hide it, delete it (with «Deshacer»), move it to another theme or
// add it to more, give it a subcategory. The pencil opens all of it, "Lo
// que usó" and the step by step included. Below, the subcategories.
export default function LibraryVideosEditor({
  videos,
  instructors,
  products,
  subcategories,
  openId = null,
}: {
  videos: AdminVideo[];
  instructors: AdminInstructor[];
  products: AdminCuponeraProduct[];
  subcategories: AdminSubcategory[];
  /** A video to open right away: one just accepted from "Enviados por instructoras". */
  openId?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(() => {
    const video = openId ? videos.find((v) => v.id === openId) : undefined;
    return video ? { id: video.id, draft: draftOf(video) } : null;
  });
  // Closing it leaves the page's address without the video to open — that
  // navigation reads the list fresh too, so a refresh on top would undo it.
  const close = (saved = false) => {
    setEditing(null);
    if (openId) router.replace("/admin/biblioteca?tab=videos", { scroll: false });
    else if (saved) router.refresh();
  };
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ title: string; restore: Restore } | null>(null);
  const [openThemes, setOpenThemes] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [theme, setTheme] = useState("");
  const [sub, setSub] = useState("");
  const [kind, setKind] = useState<"" | keyof typeof KINDS>("");
  const [show, setShow] = useState<"" | "visibles" | "ocultos">("");
  const [origin, setOrigin] = useState<"" | keyof typeof ORIGINS>("");
  const [shown, setShown] = useState(PAGE);

  const subsByKey = useMemo(() => new Map(subcategories.map((s) => [s.key, s])), [subcategories]);

  const list = useMemo(() => {
    const words = queryWords(query);
    return videos.filter((v) => {
      if (theme && v.theme !== theme && !v.extraThemes.includes(theme)) return false;
      if (sub && !v.subcategories.includes(sub)) return false;
      if (kind === "cortos" && !(v.kind === "video" && v.inShorties)) return false;
      if (kind === "videos" && !(v.kind === "video" && !v.inShorties)) return false;
      if (kind === "grabaciones" && v.kind !== "maraton") return false;
      if (show === "visibles" && !v.visible) return false;
      if (show === "ocultos" && v.visible) return false;
      if (origin && v.origin !== origin) return false;
      if (!words.length) return true;
      return (
        scoreFields(
          [
            { text: v.title, weight: 3 },
            { text: v.tags.join(" "), weight: 2 },
            { text: v.instructorName ?? v.teachersNote, weight: 2 },
            { text: v.subcategories.map((k) => subsByKey.get(k)?.name).join(" "), weight: 2 },
            { text: [v.theme, ...v.extraThemes].map(themeLabel).join(" "), weight: 1 },
          ],
          words,
        ) > 0
      );
    });
  }, [videos, query, theme, sub, kind, show, origin, subsByKey]);
  const page = list.slice(0, shown);
  const filtering = Boolean(query || theme || sub || kind || show || origin);

  // «Deshacer» stays a little while.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 20_000);
    return () => clearTimeout(timer);
  }, [undo]);

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
    setBusyId(video.id);
    setError(null);
    try {
      const { restore } = await api<{ restore: Restore }>(`/api/admin/library/videos/${video.id}`, { method: "DELETE" });
      setUndo({ title: video.title, restore });
      if (openThemes === video.id) setOpenThemes(null);
      router.refresh();
    } catch {
      setError("No se pudo borrar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  async function restore() {
    if (!undo) return;
    setBusyId("undo");
    try {
      await api("/api/admin/library/videos/restore", { method: "POST", body: JSON.stringify(undo.restore) });
      setUndo(null);
      router.refresh();
    } catch {
      setError("No se pudo deshacer. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  const resetPage = () => setShown(PAGE);

  return (
    <>
      <div style={cardStyle}>
        <CardTitle
          aside={
            <button type="button" style={primaryButtonStyle} onClick={() => setEditing({ id: null, draft: EMPTY })}>
              Nuevo video
            </button>
          }
        >
          Videos y grabaciones ({videos.length})
        </CardTitle>
        <p style={{ ...mutedText, marginTop: 0 }}>
          Todos los videos de la biblioteca: los que publicó la IA desde YouTube, los del equipo y los de las instructoras. El switch lo oculta sin borrarlo;
          la papelera lo borra (con «Deshacer»). Un video puede estar en un tema principal y en dos más.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "4px 0 10px" }}>
          <input
            aria-label="Buscar videos"
            style={{ ...control, flex: "1 1 220px" }}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Buscar por título, etiqueta o instructora"
          />
          <select
            aria-label="Tema"
            style={control}
            value={theme}
            onChange={(e) => {
              setTheme(e.target.value);
              setSub("");
              resetPage();
            }}
          >
            <option value="">Todos los temas</option>
            {LIBRARY_THEMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Subcategoría"
            style={control}
            value={sub}
            onChange={(e) => {
              setSub(e.target.value);
              resetPage();
            }}
          >
            <option value="">Todas las subcategorías</option>
            <SubcategoryOptions subcategories={theme ? subcategories.filter((s) => s.theme === theme) : subcategories} />
          </select>
          <select
            aria-label="Tipo"
            style={control}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as typeof kind);
              resetPage();
            }}
          >
            <option value="">Todos los tipos</option>
            {Object.entries(KINDS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Se ven"
            style={control}
            value={show}
            onChange={(e) => {
              setShow(e.target.value as typeof show);
              resetPage();
            }}
          >
            <option value="">Visibles y ocultos</option>
            <option value="visibles">Solo los que se ven</option>
            <option value="ocultos">Solo los ocultos</option>
          </select>
          <select
            aria-label="Quién lo puso"
            style={control}
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value as typeof origin);
              resetPage();
            }}
          >
            <option value="">Lo puso cualquiera</option>
            {Object.entries(ORIGINS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <p style={{ ...mutedText, fontSize: 12, margin: "0 0 4px" }}>
          {filtering ? `${many(list.length, "video", "videos")} con estos filtros` : many(list.length, "video", "videos")} ·{" "}
          {many(list.filter((v) => !v.visible).length, "oculto", "ocultos")}
        </p>

        {undo && (
          <div
            role="status"
            style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", margin: "8px 0", borderRadius: 10, background: "#17181c", color: "#fff", fontSize: 13 }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>Borraste «{undo.title}».</span>
            <button type="button" style={{ ...linkButton, color: "#7fe0b9", fontSize: 13 }} disabled={busyId === "undo"} onClick={restore}>
              {busyId === "undo" ? "Deshaciendo…" : "Deshacer"}
            </button>
          </div>
        )}
        {error && <FormError>{error}</FormError>}

        {videos.length === 0 ? (
          <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>
            Todavía no hay videos. Mientras tanto, el equipo ve ejemplos inventados en la biblioteca.
          </p>
        ) : list.length === 0 ? (
          <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>Ningún video con estos filtros.</p>
        ) : (
          page.map((v) => {
            const subNames = v.subcategories.map((k) => subsByKey.get(k)?.name).filter(Boolean);
            const themes = [themeLabel(v.theme), ...v.extraThemes.map((t) => `+ ${themeLabel(t)}`)].join(" ");
            const meta = [
              subNames.length ? `${themes} › ${subNames.join(", ")}` : themes,
              v.instructorName ?? v.teachersNote,
              v.durationSeconds != null ? formatDuration(v.durationSeconds) : null,
              v.views > 0 ? formatViews(v.views) : null,
            ];
            return (
              <div key={v.id} style={{ borderTop: "1px solid #efece7" }}>
                <div style={{ ...rowStyle, borderTop: "none", opacity: v.visible ? 1 : 0.6 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's still */}
                  <img
                    src={youtubeThumbnail(v.youtubeId)}
                    alt=""
                    loading="lazy"
                    width={v.kind === "maraton" ? 96 : 54}
                    height={v.kind === "maraton" ? 54 : 96}
                    style={{ objectFit: "cover", borderRadius: 8, flexShrink: 0, background: "#f0efec" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{v.title}</div>
                    <div style={{ ...mutedText, fontSize: 12 }}>{meta.filter(Boolean).join(" · ")}</div>
                    {v.tags.length > 0 && <div style={{ ...mutedText, fontSize: 12 }}>Etiquetas: {v.tags.join(", ")}</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                      {v.origin === "ia" && <Pill tone="green">Publicado por la IA</Pill>}
                      {v.origin === "instructora" && <Pill tone="pink">De una instructora</Pill>}
                      {v.kind === "maraton" && <Pill tone="grey">Grabación</Pill>}
                      {v.gated && <Pill tone="amber">Con registro</Pill>}
                      {v.kind === "video" && !v.inShorties && <Pill tone="grey">Fuera de Cortos</Pill>}
                      {v.products.length > 0 && <Pill tone="green">{v.products.length === 1 ? "1 producto" : `${v.products.length} productos`}</Pill>}
                      {!v.visible && <Pill tone="red">Oculto</Pill>}
                      <button
                        type="button"
                        style={linkButton}
                        aria-expanded={openThemes === v.id}
                        aria-label={`Temas y subcategoría de «${v.title}»`}
                        onClick={() => setOpenThemes(openThemes === v.id ? null : v.id)}
                      >
                        {openThemes === v.id ? "Cerrar temas" : "Temas y subcategoría"}
                      </button>
                    </div>
                  </div>
                  <a href={`/biblioteca/${v.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }} title="Ver en la biblioteca">
                    Ver ↗
                  </a>
                  <Switch checked={v.visible} disabled={busyId === v.id} label={v.visible ? `Ocultar «${v.title}»` : `Mostrar «${v.title}»`} onChange={(next) => setVisible(v, next)} />
                  <IconButton
                    title="Editar"
                    onClick={() => {
                      setOpenThemes(null);
                      setEditing({ id: v.id, draft: draftOf(v) });
                    }}
                  >
                    ✏️
                  </IconButton>
                  <IconButton title={`Borrar «${v.title}»`} disabled={busyId === v.id} onClick={() => remove(v)}>
                    🗑️
                  </IconButton>
                </div>
                {/* Its own state from here on: a refresh doesn't start it over. */}
                {openThemes === v.id && <QuickThemes key={v.id} video={v} subcategories={subcategories} onSaved={() => router.refresh()} />}
              </div>
            );
          })
        )}
        {list.length > shown && (
          <button type="button" style={{ ...secondaryButtonStyle, marginTop: 12 }} onClick={() => setShown((n) => n + PAGE)}>
            Ver {Math.min(PAGE, list.length - shown)} más (quedan {list.length - shown})
          </button>
        )}

        {editing && (
          <VideoForm
            id={editing.id}
            initial={editing.draft}
            instructors={instructors}
            products={products}
            subcategories={subcategories}
            onClose={() => close()}
            onSaved={() => close(true)}
          />
        )}
      </div>

      <SubcategoriesCard subcategories={subcategories} />
    </>
  );
}

/** The subcategories: rename (to another's name: they join), move, hide, delete, add. */
function SubcategoriesCard({ subcategories }: { subcategories: AdminSubcategory[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState({ name: "", theme: "tendencias" });

  async function run(id: string, action: () => Promise<unknown>, done?: (result: unknown) => string | null) {
    setBusy(id);
    setMessage(null);
    try {
      const result = await action();
      const text = done?.(result) ?? null;
      if (text) setMessage({ ok: true, text });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "No se pudo guardar. Vuelve a intentarlo." });
    } finally {
      setBusy(null);
    }
  }

  const patch = (sub: AdminSubcategory, body: Record<string, unknown>) =>
    run(
      sub.id,
      () => api<{ mergedInto: string | null }>(`/api/admin/library/subcategories/${sub.id}`, { method: "PATCH", body: JSON.stringify(body) }),
      (result) => {
        const merged = (result as { mergedInto: string | null }).mergedInto;
        return merged ? `«${sub.name}» se unió con «${merged}».` : null;
      },
    );

  const rename = (sub: AdminSubcategory) => {
    const name = (names[sub.id] ?? sub.name).trim();
    if (name.length < 2 || name === sub.name) return;
    void patch(sub, { name });
  };

  return (
    <div style={cardStyle}>
      <CardTitle>Subcategorías ({subcategories.length})</CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Grupos dentro de un tema, como Navidad o Halloween. La IA usa estas y crea una nueva solo cuando hay un grupo claro. En la biblioteca se ven
        cuando tienen 3 videos o más (y con «Subcategorías» prendido en Textos y secciones). Si a una le pones el nombre de otra, se unen.
      </p>
      {subcategories.map((s) => (
        <div key={s.id} style={{ ...rowStyle, flexWrap: "wrap", opacity: s.hidden ? 0.6 : 1 }}>
          <input
            aria-label={`Nombre de la subcategoría ${s.name}`}
            style={{ ...control, flex: "1 1 160px", fontWeight: 600 }}
            value={names[s.id] ?? s.name}
            maxLength={40}
            onChange={(e) => setNames((n) => ({ ...n, [s.id]: e.target.value }))}
            onBlur={() => rename(s)}
            onKeyDown={(e) => {
              if (e.key === "Enter") rename(s);
            }}
          />
          <select aria-label={`Tema de ${s.name}`} style={control} value={s.theme} disabled={busy === s.id} onChange={(e) => void patch(s, { theme: e.target.value })}>
            {LIBRARY_THEMES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <span style={{ ...mutedText, fontSize: 12, minWidth: 70 }}>{many(s.videos, "video", "videos")}</span>
          <span style={{ ...mutedText, fontSize: 12, minWidth: 70 }}>{s.createdBy === "ia" ? "La creó la IA" : "Del equipo"}</span>
          <Switch checked={!s.hidden} disabled={busy === s.id} label={s.hidden ? `Mostrar ${s.name}` : `Ocultar ${s.name}`} onChange={(on) => void patch(s, { hidden: !on })} />
          <IconButton
            title={`Borrar ${s.name}`}
            disabled={busy === s.id}
            onClick={() => {
              if (s.videos > 0 && !confirm(`¿Borrar «${s.name}»? Sus ${many(s.videos, "video se queda", "videos se quedan")} en la biblioteca, sin subcategoría.`)) return;
              void run(s.id, () => api(`/api/admin/library/subcategories/${s.id}`, { method: "DELETE" }));
            }}
          >
            🗑️
          </IconButton>
        </div>
      ))}
      <div style={{ ...rowStyle, flexWrap: "wrap" }}>
        <input
          aria-label="Nueva subcategoría"
          style={{ ...control, flex: "1 1 160px" }}
          value={draft.name}
          maxLength={40}
          placeholder="Nueva subcategoría"
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <select aria-label="Tema de la nueva subcategoría" style={control} value={draft.theme} onChange={(e) => setDraft((d) => ({ ...d, theme: e.target.value }))}>
          {LIBRARY_THEMES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          style={secondaryButtonStyle}
          disabled={draft.name.trim().length < 2 || busy === "new"}
          onClick={() =>
            void run(
              "new",
              () => api("/api/admin/library/subcategories", { method: "POST", body: JSON.stringify({ name: draft.name.trim(), theme: draft.theme }) }),
              () => {
                setDraft((d) => ({ ...d, name: "" }));
                return null;
              },
            )
          }
        >
          Agregar
        </button>
      </div>
      {message && <p style={{ fontSize: 13, margin: "10px 0 0", color: message.ok ? "#12966b" : "#b0225c" }}>{message.text}</p>}
    </div>
  );
}

function VideoForm({
  id,
  initial,
  instructors,
  products,
  subcategories,
  onClose,
  onSaved,
}: {
  id: string | null;
  initial: Draft;
  instructors: AdminInstructor[];
  products: AdminCuponeraProduct[];
  subcategories: AdminSubcategory[];
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
      extraThemes: d.extraThemes.filter((t) => t !== d.theme),
      subcategories: d.subcategory ? [d.subcategory] : [],
      instructorId: d.instructorId || null,
      teachersNote: d.kind === "maraton" ? d.teachersNote || null : null,
      description: d.description || null,
      products: d.products,
      steps: linesOf(d.steps),
      gated: d.gated,
      visible: d.visible,
      inShorties: d.inShorties,
      tags: d.tags,
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
      <div style={{ marginBottom: 16 }}>
        <ThemeFields
          idPrefix="video"
          theme={d.theme}
          extraThemes={d.extraThemes}
          subcategory={d.subcategory}
          subcategories={subcategories}
          onChange={(next) => setD((x) => ({ ...x, ...next }))}
        />
      </div>
      <div style={twoColumns}>
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
        <textarea id="video-description" rows={2} value={d.description} maxLength={1000} onChange={(e) => set("description", e.target.value)} />
        <span style={{ ...mutedText, fontSize: 12 }}>Una frase: sale debajo del título en Cortos y en la página del video.</span>
      </div>
      <div className="field">
        <label htmlFor="video-tags">Etiquetas (hasta {VIDEO_TAGS_UP_TO})</label>
        <TagPicker id="video-tags" value={d.tags} onChange={(tags) => set("tags", tags)} suggestions={VIDEO_TAG_SUGGESTIONS} max={VIDEO_TAGS_UP_TO} />
        <span style={{ ...mutedText, fontSize: 12 }}>Las palabras con las que se encuentra en la búsqueda; cada una abre sus cortos (nailfest.lat/biblioteca/cortos?tema=polygel).</span>
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
          label="Mostrar en Cortos"
          hint="Sale en nailfest.lat/biblioteca/cortos, los videos cortos al azar uno tras otro."
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
