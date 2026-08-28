"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type QuestionType = "TEXT" | "SELECT" | "RADIO" | "CHECKBOX" | "DATE" | "AGREEMENT";

interface QuestionRow {
  id: string;
  key: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  locked: boolean;
}

// Name/Email never show a Required toggle at all — same as Ticket
// Tailor's own "compulsory" questions — because the rest of the CRM
// (dedup key, personalization) genuinely can't function without them.
const ALWAYS_REQUIRED_KEYS = new Set(["fullName", "email"]);

// No "Opt in to receive marketing emails" type — see the
// CheckoutQuestionType enum's own comment in schema.prisma for why: that
// consent already exists as a real, connected feature (the MARKETING
// checkbox on the form, backed by the Consent table), so a question of
// that "type" here would just be a disconnected duplicate.
const TYPE_LABELS: Record<QuestionType, string> = {
  TEXT: "Texto corto",
  SELECT: "Lista desplegable",
  RADIO: "Selección única",
  CHECKBOX: "Casillas (varias opciones)",
  DATE: "Fecha",
  AGREEMENT: "Aceptación de términos (una casilla)",
};
const TYPES_WITH_OPTIONS = new Set<QuestionType>(["SELECT", "RADIO", "CHECKBOX"]);

async function api(path: string, init?: RequestInit) {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "request_failed");
  }
  return res.json().catch(() => ({}));
}

export default function CheckoutFormEditor({ initialQuestions }: { initialQuestions: QuestionRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlocked = initialQuestions.filter((q) => !q.locked);
  const editingQuestion = editingId ? initialQuestions.find((q) => q.id === editingId) : null;

  async function refresh() {
    router.refresh();
  }

  async function handleSave(id: string, patch: { label: string; required: boolean; type?: QuestionType; options?: string[] }) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/checkout-questions/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setEditingId(null);
      await refresh();
    } catch {
      setError("No se pudo guardar la pregunta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Borrar esta pregunta? Ya no se le pedirá a nadie más en el formulario.")) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/checkout-questions/${id}`, { method: "DELETE" });
      await refresh();
    } catch {
      setError("No se pudo borrar la pregunta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/checkout-questions/${id}/move`, { method: "POST", body: JSON.stringify({ direction }) });
      await refresh();
    } catch {
      setError("No se pudo mover la pregunta.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(input: { label: string; type: QuestionType; required: boolean; options: string[] }) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/checkout-questions", { method: "POST", body: JSON.stringify(input) });
      setAdding(false);
      await refresh();
    } catch {
      setError("No se pudo crear la pregunta — si es de lista, selección única o casillas, necesita al menos 2 opciones.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: 24, maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 600 }}>Buyer questions</div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: "#1c1310", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          Add a buyer question
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>Se preguntan una vez por registro.</p>

      {error && <p style={{ color: "#c2185b", fontSize: 13 }}>{error}</p>}

      {initialQuestions.map((q, i) => {
        const unlockedIdx = unlocked.findIndex((u) => u.id === q.id);
        return (
          <div
            key={q.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              fontSize: 14,
              borderBottom: i < initialQuestions.length - 1 ? "1px solid #f0efec" : "none",
            }}
          >
            <span>
              {q.label} {q.required && <span style={{ color: "#c2185b" }}>*</span>}
              {q.locked && <span style={{ fontSize: 11, color: "#8a8478", marginLeft: 8 }}>(fija)</span>}
            </span>
            <span style={{ display: "flex", gap: 4 }}>
              <IconButton title="Editar" onClick={() => setEditingId(q.id)} disabled={busy}>
                ✏️
              </IconButton>
              {!q.locked && (
                <>
                  <IconButton title="Subir" onClick={() => handleMove(q.id, "up")} disabled={busy || unlockedIdx === 0}>
                    ↑
                  </IconButton>
                  <IconButton title="Bajar" onClick={() => handleMove(q.id, "down")} disabled={busy || unlockedIdx === unlocked.length - 1}>
                    ↓
                  </IconButton>
                  <IconButton title="Borrar" onClick={() => handleDelete(q.id)} disabled={busy}>
                    🗑️
                  </IconButton>
                </>
              )}
            </span>
          </div>
        );
      })}

      {editingQuestion && (
        <Modal title="Buyer question" onClose={() => setEditingId(null)}>
          <EditQuestionForm question={editingQuestion} busy={busy} onSave={(patch) => handleSave(editingQuestion.id, patch)} onCancel={() => setEditingId(null)} />
        </Modal>
      )}

      {adding && (
        <Modal title="Buyer question" onClose={() => setAdding(false)}>
          <NewQuestionForm busy={busy} onCreate={handleCreate} onCancel={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,19,16,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", maxHeight: "85vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#5b5f6b" }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IconButton({ children, onClick, disabled, title }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{ border: "none", background: "transparent", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.3 : 1, fontSize: 14, padding: 4 }}
    >
      {children}
    </button>
  );
}

function EditQuestionForm({
  question,
  busy,
  onSave,
  onCancel,
}: {
  question: QuestionRow;
  busy: boolean;
  onSave: (patch: { label: string; required: boolean; type?: QuestionType; options?: string[] }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(question.label);
  const [required, setRequired] = useState(question.required);
  const [type, setType] = useState<QuestionType>(question.type);
  const [optionsText, setOptionsText] = useState(question.options.join("\n"));
  const showRequiredToggle = !ALWAYS_REQUIRED_KEYS.has(question.key);
  // profession's real options come from ProfessionOption (see
  // lib/professions.ts), not this table — editing them here would do
  // nothing, so that one specific row skips the type/options controls too.
  const canEditTypeAndOptions = !question.locked && question.key !== "profession";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {canEditTypeAndOptions && (
        <div className="field">
          <label>What kind of response do you want?</label>
          <select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
            {Object.entries(TYPE_LABELS).map(([value, typeLabel]) => (
              <option key={value} value={value}>
                {typeLabel}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="field">
        <label>What question do you want to ask?</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} />
      </div>
      {canEditTypeAndOptions && TYPES_WITH_OPTIONS.has(type) && (
        <div className="field">
          <label>Options for answer (Enter one answer per line)</label>
          <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={6} style={{ fontFamily: "inherit" }} />
        </div>
      )}
      {showRequiredToggle && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !label.trim()}
          onClick={() =>
            onSave({
              label: label.trim(),
              required: ALWAYS_REQUIRED_KEYS.has(question.key) ? true : required,
              type: canEditTypeAndOptions ? type : undefined,
              options: canEditTypeAndOptions ? optionsText.split("\n").map((o) => o.trim()).filter(Boolean) : undefined,
            })
          }
          style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          Save question
        </button>
      </div>
    </div>
  );
}

function NewQuestionForm({
  busy,
  onCreate,
  onCancel,
}: {
  busy: boolean;
  onCreate: (input: { label: string; type: QuestionType; required: boolean; options: string[] }) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<QuestionType>("TEXT");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="field">
        <label>What kind of response do you want?</label>
        <select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
          {Object.entries(TYPE_LABELS).map(([value, typeLabel]) => (
            <option key={value} value={value}>
              {typeLabel}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>What question do you want to ask?</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="¿Qué pregunta quieres hacer?" />
      </div>
      {TYPES_WITH_OPTIONS.has(type) && (
        <div className="field">
          <label>Options for answer (Enter one answer per line)</label>
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            rows={6}
            placeholder="Una opción por línea (mínimo 2)"
            style={{ fontFamily: "inherit" }}
          />
        </div>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required
      </label>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={{ padding: "8px 20px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !label.trim()}
          onClick={() => onCreate({ label: label.trim(), type, required, options: optionsText.split("\n").map((o) => o.trim()).filter(Boolean) })}
          style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, cursor: "pointer" }}
        >
          Save custom question
        </button>
      </div>
    </div>
  );
}
