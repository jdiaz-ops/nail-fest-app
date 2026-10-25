"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { YoutubeAdminData, YoutubeAdminVideo } from "@/lib/library/youtubeImport";
import { LIBRARY_LEVELS, LIBRARY_THEMES, youtubeThumbnail } from "@/lib/library/shared";
import { CardTitle, cardStyle, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle } from "../cuponera/ui";
import { FormError } from "./ui";

type Result = { ok: true; data: Record<string, unknown> } | { ok: false; message: string };

async function send(path: string, method: "POST" | "PATCH", body: unknown): Promise<Result> {
  try {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, data };
    return { ok: false, message: typeof data.message === "string" ? data.message : "No se pudo. Vuelve a intentarlo." };
  } catch {
    return { ok: false, message: "No hay conexión. Vuelve a intentarlo." };
  }
}

const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;

const STATUS_TABS = [
  { key: "PENDING", label: "Por revisar" },
  { key: "ADDED", label: "En la biblioteca" },
  { key: "DISCARDED", label: "Descartados" },
] as const;

const KINDS = [
  { key: "sugerido", label: "Como sugiere cada uno: cortos a Cortos, largos como grabación con registro" },
  { key: "corto", label: "Corto, en Cortos" },
  { key: "video", label: "Video, fuera de Cortos" },
  { key: "maraton", label: "Grabación con registro gratis" },
] as const;

const PAGE = 60;

const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#5b5f6b" };
const control: CSSProperties = { padding: "7px 10px", border: "1px solid #e3e1dc", borderRadius: 8, fontSize: 13, background: "#fff", color: "#17181c" };

// Editar biblioteca → YouTube (2026-10-25): the team's channel, connected
// with a free Google key; its videos brought in to review — the most viewed
// first, each with what it suggests —, and passed to the library by batches,
// hidden, to finish and switch on in Videos. Nothing goes out by itself.
export default function LibraryYoutubeImport({ data, instructors }: { data: YoutubeAdminData; instructors: { id: string; name: string }[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(!data.channel);
  const [channelInput, setChannelInput] = useState(data.channel?.input || data.suggestedChannel);
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number | null } | null>(null);

  const [status, setStatus] = useState<YoutubeAdminVideo["status"]>("PENDING");
  const [type, setType] = useState<"todos" | "cortos" | "largos">("todos");
  const [order, setOrder] = useState<"vistas" | "recientes">("vistas");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState("");
  const [level, setLevel] = useState<string>("principiante");
  const [instructorId, setInstructorId] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]["key"]>("sugerido");
  const [visible, setVisible] = useState(false);

  const counts = useMemo(() => {
    const c = { PENDING: 0, ADDED: 0, DISCARDED: 0 };
    for (const v of data.videos) c[v.status]++;
    return c;
  }, [data.videos]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = data.videos.filter(
      (v) => v.status === status && (type === "todos" || (type === "cortos") === v.short) && (!q || v.title.toLowerCase().includes(q)),
    );
    return order === "vistas" ? rows : [...rows].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }, [data.videos, status, type, order, query]);
  const visibleRows = list.slice(0, shown);
  const chosen = [...selected].filter((id) => list.some((v) => v.id === id));

  const resetSelection = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function connect() {
    setBusy("connect");
    setError(null);
    setNotice(null);
    const result = await send("/api/admin/library/youtube", "PATCH", { channel: channelInput, apiKey: apiKey || undefined });
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const channel = result.data.channel as { title: string; videoCount: number | null };
    setApiKey("");
    setEditing(false);
    setNotice(`Conectado: ${channel.title}${channel.videoCount != null ? ` · ${many(channel.videoCount, "video", "videos")} en YouTube` : ""}.`);
    router.refresh();
  }

  async function bring() {
    setBusy("bring");
    setError(null);
    setNotice(null);
    let pageToken: string | null = null;
    let done = 0;
    let added = 0;
    let total: number | null = null;
    setProgress({ done: 0, total: null });
    do {
      const result = await send("/api/admin/library/youtube/traer", "POST", { pageToken });
      if (!result.ok) {
        setError(done > 0 ? `${result.message} Ya llegaron ${many(done, "video", "videos")}: vuelve a tocar el botón para seguir.` : result.message);
        break;
      }
      const page = result.data as { added: number; updated: number; nextPageToken: string | null; total: number | null };
      done += page.added + page.updated;
      added += page.added;
      total = page.total ?? total;
      pageToken = page.nextPageToken;
      setProgress({ done, total });
      if (!pageToken) setNotice(`Listo: ${many(done, "video revisado", "videos revisados")} en tu canal, ${many(added, "nuevo", "nuevos")} para revisar.`);
    } while (pageToken);
    setProgress(null);
    setBusy(null);
    router.refresh();
  }

  async function decide(action: "pasar" | "descartar" | "revisar") {
    if (chosen.length === 0) return;
    setBusy(action);
    setError(null);
    setNotice(null);
    const body =
      action === "pasar"
        ? { action, ids: chosen, theme: theme || null, level, instructorId: instructorId || null, kind, visible }
        : { action, ids: chosen };
    const result = await send("/api/admin/library/youtube/videos", "POST", body);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const count = Number(result.data.count ?? 0);
    setNotice(
      action === "pasar"
        ? `Listo: ${many(count, "video pasó", "videos pasaron")} a la biblioteca${visible ? " y ya se ven" : ", ocultos. Termínalos y préndelos en Videos"}.`
        : action === "descartar"
          ? `Listo: ${many(count, "video descartado", "videos descartados")}.`
          : `Listo: ${many(count, "video volvió", "videos volvieron")} a «Por revisar».`,
    );
    resetSelection();
    router.refresh();
  }

  return (
    <div>
      <div style={cardStyle}>
        <CardTitle>Tu canal de YouTube</CardTitle>
        {editing ? (
          <>
            <p style={{ ...mutedText, marginTop: 0 }}>
              Lee tu canal completo de una vez: los videos llegan aquí para revisarlos, los más vistos primero, con lo que sugiere cada uno (si es un
              corto o una grabación, y su tema). Nada se publica solo; tus videos siguen en tu canal y las vistas siguen siendo tuyas.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <div style={field}>
                <label htmlFor="yt-channel">Tu canal</label>
                <input id="yt-channel" style={control} value={channelInput} onChange={(e) => setChannelInput(e.target.value)} placeholder="@tucanal" autoComplete="off" />
              </div>
              <div style={field}>
                <label htmlFor="yt-key">Llave de Google (YouTube Data API v3)</label>
                <input
                  id="yt-key"
                  style={control}
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={data.keyEnd ? `Guardada (termina en …${data.keyEnd}): vacía para no cambiarla` : "AIza…"}
                  autoComplete="off"
                />
              </div>
            </div>
            <details style={{ margin: "12px 0", fontSize: 13 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>Cómo crear la llave (gratis, unos 5 minutos)</summary>
              <ol style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6, color: "#3f424a" }}>
                <li>
                  Entra a{" "}
                  <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">
                    console.cloud.google.com
                  </a>{" "}
                  con tu cuenta de Google.
                </li>
                <li>Arriba, en «Seleccionar un proyecto», toca «Proyecto nuevo», ponle «Nail Fest» y toca «Crear».</li>
                <li>En el buscador de arriba escribe «YouTube Data API v3», ábrela y toca «Habilitar».</li>
                <li>En el menú ☰ ve a «APIs y servicios» → «Credenciales» → «Crear credenciales» → «Clave de API».</li>
                <li>
                  Copia la llave (empieza por «AIza»). Para cuidarla, toca «Editar clave», en «Restricciones de API» elige «Restringir clave», marca
                  solo «YouTube Data API v3» y guarda.
                </li>
                <li>Pégala aquí con tu canal y toca «Conectar». No cuesta nada: traer cientos de videos usa una mínima parte del uso gratis de cada día.</li>
              </ol>
            </details>
            {error && <FormError>{error}</FormError>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" style={primaryButtonStyle} disabled={busy === "connect" || !channelInput.trim() || (!apiKey && !data.keyEnd)} onClick={connect}>
                {busy === "connect" ? "Conectando…" : "Conectar"}
              </button>
              {data.channel && (
                <button type="button" style={secondaryButtonStyle} onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              )}
            </div>
          </>
        ) : (
          data.channel && (
            <>
              <p style={{ margin: "0 0 4px", fontSize: 14 }}>
                Conectado: <b>{data.channel.title}</b> <span style={mutedText}>({data.channel.input})</span>
              </p>
              <p style={{ ...mutedText, marginTop: 0 }}>
                {data.channel.importedLabel ? `La última vez que trajimos videos: ${data.channel.importedLabel}.` : "Todavía no has traído los videos."}
              </p>
              {progress && (
                <div style={{ margin: "8px 0 12px" }} role="status">
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    Trayendo videos… {progress.done}
                    {progress.total ? ` de ${progress.total}` : ""}
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: "#efece7", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: progress.total ? `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` : "8%",
                        background: "#12966b",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                </div>
              )}
              {error && <FormError>{error}</FormError>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={primaryButtonStyle} disabled={busy !== null} onClick={bring}>
                  {busy === "bring" ? "Trayendo…" : data.videos.length === 0 ? "Traer los videos" : "Buscar videos nuevos"}
                </button>
                <button type="button" style={secondaryButtonStyle} disabled={busy !== null} onClick={() => setEditing(true)}>
                  Cambiar canal o llave
                </button>
              </div>
            </>
          )
        )}
        {notice && <p style={{ margin: "12px 0 0", fontSize: 13, color: "#12966b" }}>{notice}</p>}
      </div>

      {data.videos.length > 0 && (
        <div style={cardStyle}>
          <CardTitle>Los videos de tu canal</CardTitle>
          <nav aria-label="Estado" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={status === t.key}
                onClick={() => {
                  setStatus(t.key);
                  setShown(PAGE);
                  resetSelection();
                }}
                style={{
                  ...secondaryButtonStyle,
                  padding: "6px 12px",
                  background: status === t.key ? "#17181c" : "#fff",
                  color: status === t.key ? "#fff" : "#17181c",
                  borderColor: status === t.key ? "#17181c" : "#e3e1dc",
                }}
              >
                {t.label} ({counts[t.key]})
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <select aria-label="Tipo" style={control} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="todos">Cortos y largos</option>
              <option value="cortos">Solo cortos (3 min o menos)</option>
              <option value="largos">Solo largos</option>
            </select>
            <select aria-label="Orden" style={control} value={order} onChange={(e) => setOrder(e.target.value as typeof order)}>
              <option value="vistas">Los más vistos primero</option>
              <option value="recientes">Los más recientes primero</option>
            </select>
            <input aria-label="Buscar por título" style={{ ...control, flex: "1 1 180px" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por título" />
          </div>

          {list.length === 0 ? (
            <p style={{ ...mutedText, padding: "12px 0" }}>Nada por aquí.</p>
          ) : (
            <>
              {status !== "ADDED" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "8px 0" }}>
                  <input
                    type="checkbox"
                    checked={visibleRows.length > 0 && visibleRows.every((v) => selected.has(v.id))}
                    onChange={(e) =>
                      setSelected((s) => {
                        const next = new Set(s);
                        for (const v of visibleRows) {
                          if (e.target.checked && v.privacy !== "private") next.add(v.id);
                          else next.delete(v.id);
                        }
                        return next;
                      })
                    }
                  />
                  Elegir los {visibleRows.length} que se ven
                </label>
              )}
              {visibleRows.map((v) => (
                <div key={v.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid #efece7" }}>
                  {status !== "ADDED" && (
                    <input
                      type="checkbox"
                      aria-label={`Elegir «${v.title}»`}
                      checked={selected.has(v.id)}
                      disabled={v.privacy === "private"}
                      onChange={() => toggle(v.id)}
                      style={{ marginTop: 22 }}
                    />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own still */}
                  <img src={youtubeThumbnail(v.youtubeId)} alt="" loading="lazy" width={112} height={63} style={{ flex: "none", width: 112, height: 63, objectFit: "cover", borderRadius: 8, background: "#efece7" }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <a href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 14, color: "#17181c", textDecoration: "none" }}>
                      {v.title}
                    </a>
                    <div style={{ ...mutedText, fontSize: 12, margin: "2px 0 6px" }}>
                      {[v.duration, v.viewsLabel, v.publishedLabel].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      <Pill tone={v.short ? "pink" : "grey"}>{v.short ? "Corto" : "Largo"}</Pill>
                      {v.status === "PENDING" && <Pill tone="green">{v.suggestedThemeLabel ? `Tema sugerido: ${v.suggestedThemeLabel}` : "Sin tema sugerido"}</Pill>}
                      {v.privacy === "unlisted" && <Pill tone="amber">No listado</Pill>}
                      {v.privacy === "private" && <Pill tone="red">Privado: no se puede ver</Pill>}
                      {v.status === "ADDED" &&
                        (v.libraryVideoId ? (
                          <a href={`/admin/biblioteca?tab=videos&editar=${v.libraryVideoId}`} style={{ fontSize: 12, fontWeight: 600 }}>
                            Terminar en Videos
                          </a>
                        ) : (
                          <span style={{ ...mutedText, fontSize: 12 }}>Se borró de la biblioteca</span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
              {list.length > shown && (
                <button type="button" style={{ ...secondaryButtonStyle, marginTop: 12 }} onClick={() => setShown((n) => n + PAGE)}>
                  Ver {Math.min(PAGE, list.length - shown)} más (quedan {list.length - shown})
                </button>
              )}
            </>
          )}

          {chosen.length > 0 && status === "PENDING" && (
            <div
              style={{ position: "sticky", bottom: 12, marginTop: 16, padding: 16, border: "1px solid #17181c", borderRadius: 12, background: "#fff", boxShadow: "0 10px 30px rgba(23,24,28,0.16)" }}
              aria-label="Lo que haces con los elegidos"
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{many(chosen.length, "video elegido", "videos elegidos")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
                <div style={field}>
                  <label htmlFor="yt-theme">Tema</label>
                  <select id="yt-theme" style={control} value={theme} onChange={(e) => setTheme(e.target.value)}>
                    <option value="">El sugerido de cada uno</option>
                    {LIBRARY_THEMES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={field}>
                  <label htmlFor="yt-level">Nivel</label>
                  <select id="yt-level" style={control} value={level} onChange={(e) => setLevel(e.target.value)}>
                    {LIBRARY_LEVELS.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={field}>
                  <label htmlFor="yt-instructor">Instructora</label>
                  <select id="yt-instructor" style={control} value={instructorId} onChange={(e) => setInstructorId(e.target.value)}>
                    <option value="">Ninguna (de Nail Fest)</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={field}>
                  <label htmlFor="yt-kind">Cómo entran</label>
                  <select id="yt-kind" style={control} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                    {KINDS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, margin: "12px 0" }}>
                <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
                Mostrarlos ya en la biblioteca (si no, entran ocultos para terminarlos en Videos)
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" style={primaryButtonStyle} disabled={busy !== null} onClick={() => decide("pasar")}>
                  {busy === "pasar" ? "Pasando…" : "Pasar a la biblioteca"}
                </button>
                <button type="button" style={secondaryButtonStyle} disabled={busy !== null} onClick={() => decide("descartar")}>
                  Descartar
                </button>
              </div>
            </div>
          )}
          {chosen.length > 0 && status === "DISCARDED" && (
            <div style={{ position: "sticky", bottom: 12, marginTop: 16, padding: 12, border: "1px solid #17181c", borderRadius: 12, background: "#fff", display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{many(chosen.length, "video elegido", "videos elegidos")}</span>
              <button type="button" style={secondaryButtonStyle} disabled={busy !== null} onClick={() => decide("revisar")}>
                Volver a revisar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
