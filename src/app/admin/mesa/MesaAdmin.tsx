"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { MesaAdminData, MesaEditionView, MesaPieceView } from "@/lib/mesa/data";
import {
  MESA_COMMUNITY,
  MESA_PIECE_SECTIONS,
  MESA_SECTIONS,
  NAME_TOKEN,
  contentOf,
  summaryOf,
  type MesaPieceSection,
  type MesaSectionKey,
} from "@/lib/mesa/sections";
import { CardTitle, cardStyle, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle } from "../cuponera/ui";

// La Mesa in the admin (2026-10-25), as in the approved mockup: the next
// editions and what each still needs; the bank, section by section, with
// Claude's ideas — «Aprobar» or «Otra idea», and «Editar» for a word — and
// the approved ones in the order they go out; El termómetro's questions;
// each edition's subject line. Nothing is sent from here.

type Tab = MesaPieceSection | "ASUNTO";

const ASK_HINTS: Record<MesaPieceSection, string> = {
  MITO: "Tema, si quieres: cutículas, gel, cuidado en casa…",
  PALABRA: "Tema, si quieres: acrílico, herramientas, anatomía…",
  SABIAS: "Tema, si quieres: historia, uñas de los pies…",
  TRUCO: "Tema, si quieres: polygel, retiro, esmaltado…",
  PORQUE: "Tema, si quieres: levantamiento, manchas, quiebres…",
  TERMOMETRO: "Tema, si quieres: precios, clientas, materiales…",
};

const nail = (color: string, w = 10, h = 13): ReactNode => (
  <i style={{ display: "inline-block", flex: "none", width: w, height: h, background: color, borderRadius: "50% 50% 3px 3px / 62% 62% 3px 3px" }} aria-hidden="true" />
);

const iaPill = (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 10px", borderRadius: 999, background: "#efeafd", color: "#5137a8", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
    ✦ Idea de la IA
  </span>
);

const linkButton: CSSProperties = { border: "none", background: "transparent", padding: 0, fontSize: 13, color: "#5b5f6b", textDecoration: "underline", cursor: "pointer" };
const fieldStyle: CSSProperties = { width: "100%", padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8, fontSize: 14, fontFamily: "inherit" };

async function call(path: string, init: RequestInit): Promise<{ ok: boolean; id?: string }> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof body?.message === "string" ? body.message : "No se pudo. Vuelve a intentarlo.");
  return body;
}

/** «{nombre}» as each person will see it: their name. */
function withName(text: string): ReactNode {
  const parts = text.split(NAME_TOKEN);
  return parts.map((part, i) => (
    <span key={i}>
      {part}
      {i < parts.length - 1 && (
        <span title="Cada persona ve su nombre" style={{ padding: "0 6px", borderRadius: 6, background: "#fde8ef", color: "#b0225c" }}>
          nombre
        </span>
      )}
    </span>
  ));
}

// ── A piece, as it reads ────────────────────────────────────────────────────

function PieceBody({ section, content }: { section: MesaSectionKey; content: unknown }) {
  const quote: CSSProperties = { margin: "0 0 8px", fontSize: 17, fontWeight: 700, lineHeight: 1.35 };
  const expl: CSSProperties = { margin: 0, fontSize: 14, color: "#33363d", lineHeight: 1.5 };
  const small: CSSProperties = { display: "block", margin: "10px 0 2px", fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#5b5f6b" };
  switch (section) {
    case "MITO": {
      const c = contentOf("MITO", content);
      if (!c) return null;
      return (
        <>
          <p style={quote}>«{c.statement}»</p>
          <div style={{ marginBottom: 6 }}>{c.answer === "mito" ? <Pill tone="red">Mito</Pill> : <Pill tone="green">Verdad</Pill>}</div>
          <p style={expl}>{c.explanation}</p>
        </>
      );
    }
    case "PALABRA": {
      const c = contentOf("PALABRA", content);
      if (!c) return null;
      return (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <b style={{ fontSize: 24, fontFamily: "Georgia, serif", color: "#0b5c57" }}>{c.word}</b>
            <span style={{ fontSize: 13, color: "#5b5f6b", fontStyle: "italic" }}>{c.kind}</span>
          </div>
          <p style={expl}>{c.definition}</p>
          <div style={{ marginTop: 8, padding: "8px 12px", borderLeft: "3px solid #0f7d76", borderRadius: "3px 10px 10px 3px", background: "#f1faf8", fontSize: 13.5 }}>
            <b style={{ display: "block", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#0f7d76" }}>Úsala así</b>«{c.example}»
          </div>
        </>
      );
    }
    case "SABIAS": {
      const c = contentOf("SABIAS", content);
      if (!c) return null;
      return (
        <>
          <p style={quote}>{c.fact}</p>
          <p style={expl}>{c.detail}</p>
        </>
      );
    }
    case "TRUCO": {
      const c = contentOf("TRUCO", content);
      if (!c) return null;
      return (
        <>
          <p style={quote}>{c.title}</p>
          <p style={expl}>{c.trick}</p>
        </>
      );
    }
    case "PORQUE": {
      const c = contentOf("PORQUE", content);
      if (!c) return null;
      return (
        <>
          <p style={quote}>{c.question}</p>
          <span style={small}>Las causas</span>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#33363d" }}>
            {c.causes.map((cause, i) => (
              <li key={i}>{cause}</li>
            ))}
          </ul>
          <span style={small}>Cómo evitarlo</span>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: "#33363d" }}>
            {c.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </>
      );
    }
    case "TERMOMETRO": {
      const c = contentOf("TERMOMETRO", content);
      if (!c) return null;
      return (
        <>
          <p style={quote}>{c.question}</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {c.options.map((option, i) => (
              <span key={i} style={{ padding: "5px 12px", border: "1.5px solid #17181c", borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
                {option}
              </span>
            ))}
          </div>
        </>
      );
    }
    case "ASUNTO": {
      const c = contentOf("ASUNTO", content);
      if (!c) return null;
      return (
        <>
          <p style={{ ...quote, fontSize: 16, margin: 0 }}>{withName(c.subject)}</p>
          <p style={{ ...expl, color: "#5b5f6b", marginTop: 2 }}>{c.preheader}</p>
          {c.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {c.tags.map((tag) => (
                <span key={tag} style={{ padding: "2px 9px", borderRadius: 999, background: "#f0efec", color: "#5b5f6b", fontSize: 11.5, fontWeight: 700 }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </>
      );
    }
  }
}

// ── «Editar» ────────────────────────────────────────────────────────────────

type Field = { key: string; label: string; kind: "line" | "box" | "lines" | "answer" };
const FIELDS: Record<MesaSectionKey, Field[]> = {
  MITO: [
    { key: "statement", label: "La frase", kind: "box" },
    { key: "answer", label: "¿Mito o verdad?", kind: "answer" },
    { key: "explanation", label: "La explicación", kind: "box" },
  ],
  PALABRA: [
    { key: "word", label: "La palabra", kind: "line" },
    { key: "kind", label: "Tipo (sustantivo, verbo…)", kind: "line" },
    { key: "definition", label: "La definición", kind: "box" },
    { key: "example", label: "Úsala así", kind: "box" },
  ],
  SABIAS: [
    { key: "fact", label: "El dato", kind: "box" },
    { key: "detail", label: "El detalle", kind: "box" },
  ],
  TRUCO: [
    { key: "title", label: "El problema", kind: "line" },
    { key: "trick", label: "El truco", kind: "box" },
  ],
  PORQUE: [
    { key: "question", label: "La pregunta", kind: "line" },
    { key: "causes", label: "Las causas (una por línea, de 2 a 4)", kind: "lines" },
    { key: "steps", label: "Cómo evitarlo (3 pasos, uno por línea)", kind: "lines" },
  ],
  TERMOMETRO: [
    { key: "question", label: "La pregunta", kind: "line" },
    { key: "options", label: "Las opciones (una por línea, de 2 a 4)", kind: "lines" },
  ],
  ASUNTO: [
    { key: "subject", label: `El asunto (${NAME_TOKEN} es el nombre de cada persona)`, kind: "line" },
    { key: "preheader", label: "La segunda línea (la gris en la bandeja)", kind: "line" },
    { key: "intro", label: "El saludo (va después de «Hola, nombre.»)", kind: "box" },
  ],
};

function PieceEditor({ piece, onSave, onCancel, busy }: { piece: MesaPieceView; onSave: (content: Record<string, unknown>) => void; onCancel: () => void; busy: boolean }) {
  const start = (piece.content ?? {}) as Record<string, unknown>;
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS[piece.section].map((f) => [f.key, Array.isArray(start[f.key]) ? (start[f.key] as string[]).join("\n") : String(start[f.key] ?? "")])),
  );
  function save() {
    const content: Record<string, unknown> = { ...start };
    for (const f of FIELDS[piece.section]) {
      const value = draft[f.key] ?? "";
      content[f.key] = f.kind === "lines" ? value.split("\n").map((l) => l.trim()).filter(Boolean) : value.trim();
    }
    onSave(content);
  }
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {FIELDS[piece.section].map((f) => (
        <label key={f.key} style={{ display: "grid", gap: 4, fontSize: 13, fontWeight: 600 }}>
          {f.label}
          {f.kind === "answer" ? (
            <select value={draft[f.key]} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} style={fieldStyle}>
              <option value="mito">Mito</option>
              <option value="verdad">Verdad</option>
            </select>
          ) : f.kind === "line" ? (
            <input value={draft[f.key]} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} style={fieldStyle} />
          ) : (
            <textarea rows={f.kind === "lines" ? 4 : 3} value={draft[f.key]} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} style={fieldStyle} />
          )}
        </label>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={primaryButtonStyle} disabled={busy} onClick={save}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" style={secondaryButtonStyle} disabled={busy} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── The screen ──────────────────────────────────────────────────────────────

export default function MesaAdmin({ data }: { data: MesaAdminData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("MITO");
  const [topics, setTopics] = useState<Partial<Record<MesaPieceSection, string>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  // Each problem shows in the card where it happened.
  const [error, setError] = useState<{ at: "key" | "editions" | "bank"; message: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState("");

  async function run(key: string, work: () => Promise<unknown>, at: "key" | "editions" | "bank" = "bank") {
    setBusy(key);
    setError(null);
    try {
      await work();
      router.refresh();
    } catch (e) {
      setError({ at, message: e instanceof Error ? e.message : "No se pudo. Vuelve a intentarlo." });
    } finally {
      setBusy(null);
    }
  }
  const alert = (at: "key" | "editions" | "bank") =>
    error?.at === at && (
      <p role="alert" style={{ margin: "12px 0", padding: "10px 14px", borderRadius: 10, background: "#fde8ef", color: "#b0225c", fontSize: 13.5 }}>
        {error.message}
      </p>
    );
  const act = (id: string, action: "approve" | "another" | "remove" | "up" | "down") =>
    run(action === "another" ? `another:${id}` : id, () => call(`/api/admin/mesa/piezas/${id}`, { method: "POST", body: JSON.stringify({ action }) }));
  const saveEdit = (id: string, content: Record<string, unknown>) =>
    run(`edit:${id}`, async () => {
      await call(`/api/admin/mesa/piezas/${id}`, { method: "PATCH", body: JSON.stringify({ content }) });
      setEditing(null);
    });
  const askIdeas = (section: MesaPieceSection) =>
    run(`ask:${section}`, () => call("/api/admin/mesa/ideas", { method: "POST", body: JSON.stringify({ section, topic: topics[section] ?? "" }) }));
  const askSubjects = (edition: number) => run(`subjects:${edition}`, () => call("/api/admin/mesa/asuntos", { method: "POST", body: JSON.stringify({ edition }) }));
  const saveSettings = (body: Record<string, string>, after: () => void) =>
    run(
      "settings",
      async () => {
        await call("/api/admin/mesa/ajustes", { method: "PATCH", body: JSON.stringify(body) });
        after();
      },
      "claudeKey" in body ? "key" : "editions",
    );

  // The section an upcoming edition still needs a piece of: its tab says so.
  const missing = new Set(data.editions.flatMap((e) => e.slots.filter((s) => !s.pieceId).map((s) => s.section)));

  const ideaCard = (piece: MesaPieceView, labels: { yes: string; other: string } = { yes: "Aprobar", other: "Otra idea" }) => {
    const color = piece.section === "ASUNTO" ? "#c9c4ba" : MESA_SECTIONS[piece.section].color;
    const replacing = busy === `another:${piece.id}`;
    return (
      <div key={piece.id} style={{ position: "relative", border: "1px solid #e3e1dc", borderRadius: 12, padding: "16px 18px", marginBottom: 10, background: "#fff" }}>
        <span style={{ position: "absolute", left: -1, top: 14, bottom: 14, width: 4, borderRadius: "0 4px 4px 0", background: color }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          {piece.section !== "ASUNTO" && nail(color)}
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: piece.section === "ASUNTO" ? "#8a8478" : color }}>
            {piece.section === "ASUNTO" ? "Asunto" : MESA_SECTIONS[piece.section].name}
          </span>
          {piece.topic && <span style={{ ...mutedText, fontSize: 12 }}>· {piece.topic}</span>}
          <span style={{ marginLeft: "auto" }}>{iaPill}</span>
        </div>
        {replacing ? (
          <p style={{ ...mutedText, margin: "8px 0" }}>La IA está escribiendo otra idea…</p>
        ) : editing === piece.id ? (
          <PieceEditor piece={piece} busy={busy === `edit:${piece.id}`} onSave={(content) => saveEdit(piece.id, content)} onCancel={() => setEditing(null)} />
        ) : (
          <>
            <PieceBody section={piece.section} content={piece.content} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button type="button" style={primaryButtonStyle} disabled={busy !== null} onClick={() => act(piece.id, "approve")}>
                ✓ {labels.yes}
              </button>
              <button type="button" style={secondaryButtonStyle} disabled={busy !== null} onClick={() => act(piece.id, "another")}>
                ↻ {labels.other}
              </button>
              <button type="button" style={{ ...linkButton, marginLeft: "auto" }} disabled={busy !== null} onClick={() => setEditing(piece.id)}>
                Editar
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const secondLine = (piece: MesaPieceView): string => {
    if (piece.section === "MITO") return contentOf("MITO", piece.content)?.answer === "mito" ? "Mito" : "Verdad";
    if (piece.section === "TERMOMETRO") return (contentOf("TERMOMETRO", piece.content)?.options ?? []).join(" · ");
    if (piece.section === "PALABRA") return contentOf("PALABRA", piece.content)?.kind ?? "";
    return piece.topic ? `Tema: ${piece.topic}` : "";
  };

  const sectionPanel = (section: MesaPieceSection) => {
    const ideas = data.ideas[section];
    const approved = data.approved[section];
    const asking = busy === `ask:${section}`;
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "#f7f5f1", marginBottom: 14, flexWrap: "wrap" }}>
          <b style={{ fontSize: 14 }}>{section === "TERMOMETRO" ? "Preguntas que sugiere la IA" : "Ideas nuevas de la IA"}</b>
          <input
            aria-label="Tema (opcional)"
            value={topics[section] ?? ""}
            maxLength={60}
            placeholder={ASK_HINTS[section]}
            onChange={(e) => setTopics((t) => ({ ...t, [section]: e.target.value }))}
            style={{ ...fieldStyle, flex: 1, minWidth: 200, width: "auto" }}
          />
          <button type="button" style={primaryButtonStyle} disabled={busy !== null || !data.keyReady} onClick={() => askIdeas(section)}>
            {asking ? "La IA está escribiendo…" : "✦ Pedir 5 ideas"}
          </button>
        </div>
        {ideas.length === 0 ? (
          <p style={{ ...mutedText, margin: "0 0 10px" }}>{asking ? "Pidiendo ideas a la IA: tarda unos segundos." : "No hay ideas esperando: pídele 5 a la IA."}</p>
        ) : (
          ideas.map((piece) => ideaCard(piece))
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "22px 0 6px", gap: 12, flexWrap: "wrap" }}>
          <b style={{ fontSize: 14 }}>En el banco: salen en este orden</b>
          <span style={mutedText}>Usa las flechas para cambiar el orden</span>
        </div>
        {approved.length === 0 && <p style={{ ...mutedText, margin: 0 }}>Todavía no hay ninguna aprobada.</p>}
        {approved.map((piece, index) =>
          editing === piece.id ? (
            <div key={piece.id} style={{ padding: "12px 0", borderTop: "1px solid #efece7" }}>
              <PieceEditor piece={piece} busy={busy === `edit:${piece.id}`} onSave={(content) => saveEdit(piece.id, content)} onCancel={() => setEditing(null)} />
            </div>
          ) : (
            <div key={piece.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #efece7", fontSize: 14 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", background: "#f0efec", fontSize: 12, fontWeight: 700, flex: "none" }}>
                {index + 1}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                {section === "MITO" ? `«${summaryOf(section, piece.content)}»` : summaryOf(section, piece.content)}
                {secondLine(piece) && <small style={{ display: "block", fontSize: 12, color: "#5b5f6b" }}>{secondLine(piece)}</small>}
              </span>
              {piece.editionLabel ? <Pill tone={index === 0 ? "green" : "grey"}>{piece.editionLabel}</Pill> : <Pill tone="grey">Más adelante</Pill>}
              <span style={{ display: "flex", gap: 2 }}>
                <button type="button" title="Subir" aria-label="Subir" style={{ ...linkButton, textDecoration: "none", fontSize: 15, padding: 4 }} disabled={busy !== null || index === 0} onClick={() => act(piece.id, "up")}>
                  ↑
                </button>
                <button
                  type="button"
                  title="Bajar"
                  aria-label="Bajar"
                  style={{ ...linkButton, textDecoration: "none", fontSize: 15, padding: 4 }}
                  disabled={busy !== null || index === approved.length - 1}
                  onClick={() => act(piece.id, "down")}
                >
                  ↓
                </button>
              </span>
              <button type="button" style={linkButton} disabled={busy !== null} onClick={() => setEditing(piece.id)}>
                Editar
              </button>
              <button
                type="button"
                style={linkButton}
                disabled={busy !== null}
                onClick={() => confirm("¿Quitar esta pieza del banco? No vuelve a salir.") && act(piece.id, "remove")}
              >
                Quitar
              </button>
            </div>
          ),
        )}
      </>
    );
  };

  const subjectsPanel = () => (
    <>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Con lo que trae cada edición, la IA escribe 5 asuntos con su segunda línea (la gris en la bandeja) y el saludo. Elige uno o pide otros.
      </p>
      {data.editions.map((edition) => (
        <div key={edition.number} style={{ border: "1px solid #e3e1dc", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <b style={{ fontSize: 15 }}>
              Edición {edition.number} · {edition.label}
            </b>
            <span style={{ ...mutedText, fontSize: 12 }}>{edition.slots.map((s) => MESA_SECTIONS[s.section].name).join(" · ")}</span>
          </div>
          {!edition.complete ? (
            <p style={{ ...mutedText, margin: 0 }}>Primero aprueba las piezas de esta edición: el asunto sale de ellas.</p>
          ) : (
            <>
              {edition.subject && (
                <div style={{ border: "1px solid #12966b", boxShadow: "0 0 0 2px #e3f6ee", borderRadius: 12, padding: "14px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Pill tone="green">✓ Elegido</Pill>
                    {edition.subject.outdated && <Pill tone="amber">Cambiaron las piezas: pide asuntos nuevos</Pill>}
                    <span style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
                      <button type="button" style={linkButton} disabled={busy !== null} onClick={() => setEditing(edition.subject!.id)}>
                        Editar
                      </button>
                      <button type="button" style={linkButton} disabled={busy !== null} onClick={() => act(edition.subject!.id, "remove")}>
                        Cambiar
                      </button>
                    </span>
                  </div>
                  {editing === edition.subject.id ? (
                    <PieceEditor
                      piece={edition.subject}
                      busy={busy === `edit:${edition.subject.id}`}
                      onSave={(content) => saveEdit(edition.subject!.id, content)}
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <PieceBody section="ASUNTO" content={edition.subject.content} />
                      <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "#33363d" }}>
                        <b>Saludo:</b> Hola, {withName(NAME_TOKEN)}. {contentOf("ASUNTO", edition.subject.content)?.intro}
                      </p>
                    </>
                  )}
                </div>
              )}
              {edition.subjectIdeas.map((piece) => ideaCard(piece, { yes: "Usar este", other: "Otra idea" }))}
              <button type="button" style={primaryButtonStyle} disabled={busy !== null || !data.keyReady} onClick={() => askSubjects(edition.number)}>
                {busy === `subjects:${edition.number}` ? "La IA está escribiendo…" : edition.subjectIdeas.length || edition.subject ? "✦ Pedir 5 asuntos más" : "✦ Pedir 5 asuntos"}
              </button>
            </>
          )}
        </div>
      ))}
    </>
  );

  const editionBox = (edition: MesaEditionView, index: number) => {
    const missingPieces = edition.slots.filter((s) => !s.pieceId).length;
    const subjectOk = edition.subject !== null && !edition.subject.outdated;
    const left = missingPieces + (subjectOk ? 0 : 1);
    return (
      <div key={edition.number} style={{ border: "1px solid #e3e1dc", borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>
            Edición {edition.number}
            <small style={{ display: "block", fontSize: 12, color: "#5b5f6b", fontWeight: 400 }}>
              {edition.label.charAt(0).toUpperCase() + edition.label.slice(1)}
            </small>
          </b>
          {left === 0 ? <Pill tone="green">Lista</Pill> : <Pill tone={index === 0 ? "amber" : "grey"}>{left === 1 ? "Falta 1" : `Faltan ${left}`}</Pill>}
        </div>
        {edition.slots.map((slot) => (
          <div key={slot.section} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #f3f1ec", fontSize: 13 }}>
            {nail(MESA_SECTIONS[slot.section].color)}
            <span style={{ flex: 1 }}>{MESA_SECTIONS[slot.section].name}</span>
            {slot.pieceId ? (
              <em style={{ fontStyle: "normal", fontSize: 12, fontWeight: 700, color: "#0d6e4f" }}>✓ Lista</em>
            ) : (
              <button type="button" style={{ ...linkButton, fontSize: 12, fontWeight: 700, color: "#a5471a" }} onClick={() => setTab(slot.section)}>
                {slot.section === "TERMOMETRO" ? "Falta la pregunta" : "Falta"}
              </button>
            )}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #f3f1ec", fontSize: 13 }}>
          <span style={{ width: 10, textAlign: "center", fontSize: 11 }}>✉</span>
          <span style={{ flex: 1 }}>Asunto</span>
          {subjectOk ? (
            <em style={{ fontStyle: "normal", fontSize: 12, fontWeight: 700, color: "#0d6e4f" }}>✓ Elegido</em>
          ) : (
            <button type="button" style={{ ...linkButton, fontSize: 12, fontWeight: 700, color: edition.complete ? "#a5471a" : "#8a8478" }} onClick={() => setTab("ASUNTO")}>
              {edition.complete ? "Elegir" : "Cuando esté completa"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>La Mesa</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0 }}>
        El correo de Nail Fest, cada 15 días, el jueves. La IA propone las piezas de cada sección; tú solo apruebas o pides otra idea. Todavía no se
        envía nada: aquí se arma el banco.
      </p>

      {!data.keyReady && (
        <div style={{ ...cardStyle, borderColor: "#f3c9b0", background: "#fffaf6" }}>
          <CardTitle>La llave de Claude</CardTitle>
          <p style={{ ...mutedText, marginTop: 0 }}>La IA necesita la llave de Claude para escribir. Pégala aquí (empieza por «sk-ant-»): es la misma que usaba el piloto automático.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder="sk-ant-…" style={{ ...fieldStyle, flex: 1 }} />
            <button type="button" style={primaryButtonStyle} disabled={busy !== null || !keyDraft.trim()} onClick={() => saveSettings({ claudeKey: keyDraft.trim() }, () => setKeyDraft(""))}>
              {busy === "settings" ? "Revisando…" : "Guardar"}
            </button>
          </div>
          {alert("key")}
        </div>
      )}

      <div style={cardStyle}>
        <CardTitle
          aside={
            dateDraft === null ? (
              <span style={mutedText}>
                Primera edición: {data.firstEditionLabel} ·{" "}
                <button type="button" style={linkButton} onClick={() => setDateDraft(data.firstEditionOn)}>
                  Cambiar
                </button>
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="date" aria-label="Primera edición" value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} style={{ ...fieldStyle, width: "auto", padding: "5px 8px" }} />
                <button type="button" style={{ ...primaryButtonStyle, padding: "6px 14px" }} disabled={busy !== null} onClick={() => saveSettings({ firstEditionOn: dateDraft }, () => setDateDraft(null))}>
                  Guardar
                </button>
                <button type="button" style={linkButton} onClick={() => setDateDraft(null)}>
                  Cancelar
                </button>
              </span>
            )
          }
        >
          Próximas ediciones
        </CardTitle>
        <p style={{ ...mutedText, marginTop: 0 }}>Rotan solas: una para jugar y una para el oficio. El termómetro sale en todas.</p>
        {alert("editions")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>{data.editions.map(editionBox)}</div>
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#5b5f6b", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {nail(MESA_COMMUNITY.galeria.color, 9, 12)} La galería y {nail(MESA_COMMUNITY.consultorio.color, 9, 12)} El Consultorio salen solos, con lo que manda la comunidad.
        </p>
      </div>

      <div style={cardStyle}>
        <CardTitle aside={<span style={mutedText}>El número es cuántas hay aprobadas · en naranja, las que necesita una próxima edición</span>}>El banco</CardTitle>
        <nav aria-label="Secciones de La Mesa" style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "14px 0 18px" }}>
          {[...MESA_PIECE_SECTIONS, "ASUNTO" as const].map((key) => {
            const on = key === tab;
            const count = key === "ASUNTO" ? null : data.approved[key].length;
            const low = key !== "ASUNTO" && missing.has(key);
            return (
              <button
                key={key}
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => {
                  setTab(key);
                  setError(null);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: `1px solid ${on ? "#17181c" : "#e3e1dc"}`,
                  background: on ? "#17181c" : "#fff",
                  color: on ? "#fff" : "#17181c",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {key !== "ASUNTO" && nail(MESA_SECTIONS[key].color)}
                {key === "ASUNTO" ? "Asuntos" : MESA_SECTIONS[key].name}
                {count !== null && (
                  <small
                    style={{
                      fontWeight: 700,
                      fontSize: 11.5,
                      padding: "0 7px",
                      borderRadius: 999,
                      background: on ? "rgba(255,255,255,.18)" : low ? "#fff3ea" : "#f0efec",
                      color: on ? "#fff" : low ? "#a5471a" : "#5b5f6b",
                    }}
                  >
                    {count}
                  </small>
                )}
              </button>
            );
          })}
        </nav>
        {alert("bank")}
        {tab === "ASUNTO" ? subjectsPanel() : sectionPanel(tab)}
      </div>

      <div style={{ ...cardStyle, background: "#f7f5f1", borderColor: "#efece7" }}>
        <b style={{ fontSize: 14 }}>Cómo escribe la IA</b>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, color: "#33363d" }}>
          <li>Con el tono de La Mesa: cercano, de tú, frases cortas.</li>
          <li>No repite lo que ya salió, lo que está en el banco ni lo que descartaste.</li>
          <li>Si no está segura de un dato, no lo propone. Igual léelo antes de aprobar: tú das la última palabra.</li>
          <li>Los resultados del termómetro serán siempre los votos reales; la IA solo escribe la frase que los resume.</li>
        </ul>
      </div>
    </div>
  );
}
