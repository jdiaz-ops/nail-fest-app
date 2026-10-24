"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminClass, AdminInstructor } from "@/lib/library/admin";
import { api, CardTitle, cardStyle, IconButton, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle, Switch } from "../cuponera/ui";
import { Check, FormError, Sheet, rowStyle, twoColumns } from "./ui";

interface Draft {
  instructorId: string;
  title: string;
  startsAt: string;
  place: string;
  priceLabel: string;
  url: string;
  visible: boolean;
}

// Editar biblioteca → Clases: what shows in "Próximas clases" on each
// instructor's profile. "Inscribirme" opens her own sign-up link (WhatsApp,
// page or form): Nail Fest shows the class, doesn't take the booking.
export default function LibraryClassesEditor({ classes, instructors }: { classes: AdminClass[]; instructors: AdminInstructor[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upcoming = classes.filter((c) => !c.past).reverse();
  const past = classes.filter((c) => c.past);

  async function setVisible(c: AdminClass, visible: boolean) {
    setBusyId(c.id);
    setError(null);
    try {
      await api(`/api/admin/library/classes/${c.id}`, { method: "PATCH", body: JSON.stringify({ visible }) });
      router.refresh();
    } catch {
      setError("No se pudo cambiar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(c: AdminClass) {
    if (!confirm(`¿Eliminar la clase «${c.title}»?`)) return;
    setBusyId(c.id);
    setError(null);
    try {
      await api(`/api/admin/library/classes/${c.id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setError("No se pudo eliminar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  const row = (c: AdminClass, isPast: boolean) => (
    <div key={c.id} style={{ ...rowStyle, opacity: c.visible && !isPast ? 1 : 0.55 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</div>
        <div style={{ ...mutedText, fontSize: 12 }}>
          {[c.instructorName, c.startsAtLabel, c.place, c.priceLabel].filter(Boolean).join(" · ")}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          {isPast && <Pill tone="grey">Ya pasó</Pill>}
          {!c.url && <Pill tone="red">Sin link: no sale «Inscribirme»</Pill>}
          {!c.visible && <Pill tone="red">Oculta</Pill>}
        </div>
      </div>
      <Switch checked={c.visible} disabled={busyId === c.id} label={c.visible ? "Visible" : "Oculta"} onChange={(next) => setVisible(c, next)} />
      <IconButton
        title="Editar"
        onClick={() =>
          setEditing({
            id: c.id,
            draft: { instructorId: c.instructorId, title: c.title, startsAt: c.startsAtInput, place: c.place, priceLabel: c.priceLabel ?? "", url: c.url ?? "", visible: c.visible },
          })
        }
      >
        ✏️
      </IconButton>
      <IconButton title="Eliminar" disabled={busyId === c.id} onClick={() => remove(c)}>
        🗑️
      </IconButton>
    </div>
  );

  return (
    <div style={cardStyle}>
      <CardTitle
        aside={
          <button
            type="button"
            style={primaryButtonStyle}
            disabled={instructors.length === 0}
            onClick={() => setEditing({ id: null, draft: { instructorId: instructors[0]?.id ?? "", title: "", startsAt: "", place: "", priceLabel: "", url: "", visible: true } })}
          >
            Nueva clase
          </button>
        }
      >
        Clases de las instructoras
      </CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Salen en «Próximas clases» del perfil de cada instructora hasta que pasan. «Inscribirme» lleva al link de ella (su WhatsApp, su página o
        su formulario): Nail Fest muestra la clase, no recibe las reservas.
      </p>
      {error && <FormError>{error}</FormError>}
      {instructors.length === 0 && <p style={{ ...mutedText, margin: 0 }}>Primero agrega una instructora.</p>}
      {classes.length === 0 && instructors.length > 0 && (
        <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>Todavía no hay clases.</p>
      )}
      {upcoming.map((c) => row(c, false))}
      {past.length > 0 && <div style={{ ...mutedText, fontSize: 12, fontWeight: 700, padding: "14px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ya pasaron</div>}
      {past.map((c) => row(c, true))}

      {editing && (
        <ClassForm
          id={editing.id}
          initial={editing.draft}
          instructors={instructors}
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

function ClassForm({
  id,
  initial,
  instructors,
  onClose,
  onSaved,
}: {
  id: string | null;
  initial: Draft;
  instructors: AdminInstructor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));

  async function save() {
    if (!d.instructorId || d.title.trim().length < 3 || !d.startsAt || d.place.trim().length < 2) return setMessage("Falta la instructora, el título, la fecha o el lugar.");
    if (!d.url.trim().startsWith("https://")) return setMessage("Falta el link de inscripción de la instructora (empieza por https://): su WhatsApp (https://wa.me/57…), su página o su formulario.");
    setSaving(true);
    setMessage(null);
    const body = { ...d, priceLabel: d.priceLabel || null, url: d.url.trim() };
    try {
      await api(id ? `/api/admin/library/classes/${id}` : "/api/admin/library/classes", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    } catch {
      setMessage("No se pudo guardar. Revisa los datos y vuelve a intentarlo.");
      setSaving(false);
    }
  }

  return (
    <Sheet title={id ? "Editar clase" : "Nueva clase"} onClose={onClose}>
      <div className="field">
        <label htmlFor="class-instructor">Instructora</label>
        <select id="class-instructor" value={d.instructorId} onChange={(e) => set("instructorId", e.target.value)}>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} · {i.city}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="class-title">Título</label>
        <input id="class-title" value={d.title} maxLength={120} placeholder="Maratón de polygel" onChange={(e) => set("title", e.target.value)} />
      </div>
      <div style={twoColumns}>
        <div className="field">
          <label htmlFor="class-starts">Fecha y hora (hora de Colombia)</label>
          <input id="class-starts" type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="class-place">Lugar</label>
          <input id="class-place" value={d.place} maxLength={120} placeholder="En línea por Zoom" onChange={(e) => set("place", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="class-price">Precio o condición (opcional)</label>
          <input id="class-price" value={d.priceLabel} maxLength={60} placeholder="Gratis con registro" onChange={(e) => set("priceLabel", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="class-url">Link de inscripción de ella</label>
          <input id="class-url" value={d.url} maxLength={500} placeholder="https://wa.me/57… o su página" onChange={(e) => set("url", e.target.value)} />
        </div>
      </div>
      <Check checked={d.visible} onChange={(v) => set("visible", v)} label="Visible en su perfil" />
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
