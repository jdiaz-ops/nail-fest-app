"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LandingBlocksEditor from "@/app/admin/events/LandingBlocksEditor";
import type { LandingBlock } from "@/lib/landingBlocks/types";

export interface InfoPageFormValues {
  id?: string;
  eventId: string;
  title: string;
  slug: string;
  intro: string;
  blocks: LandingBlock[];
  published: boolean;
  showRegisterButton: boolean;
}

// One topic page of an event (cronograma, expositores, el lugar…) — see
// the InfoPage model. Same blocks editor as the event page itself, saved
// whole with one button.
export default function InfoPageForm({
  initial,
  events,
  siteOrigin,
}: {
  initial: InfoPageFormValues;
  events: { id: string; name: string; slug: string }[];
  siteOrigin: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<InfoPageFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSlug, setSavedSlug] = useState(initial.id ? initial.slug : "");
  const isEdit = Boolean(initial.id);
  const event = events.find((e) => e.id === values.eventId);
  const publicUrl = event && savedSlug ? `${siteOrigin}/${event.slug}/${savedSlug}` : null;

  function set<K extends keyof InfoPageFormValues>(key: K, value: InfoPageFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("Ponle un título a la página.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(isEdit ? `/api/admin/pages/${initial.id}` : "/api/admin/pages", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: values.eventId,
        title: values.title.trim(),
        slug: values.slug.trim(),
        intro: values.intro.trim(),
        blocks: values.blocks,
        published: values.published,
        showRegisterButton: values.showRegisterButton,
      }),
    }).catch(() => null);
    setSaving(false);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) {
      setError(body?.error === "event_not_found" ? "Ese evento ya no existe." : "No se pudo guardar. Revisa los campos e intenta de nuevo.");
      return;
    }
    setSavedSlug(body.slug);
    set("slug", body.slug);
    if (!isEdit) {
      router.push(`/admin/pages/${body.id}`);
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!initial.id || !confirm("¿Eliminar esta página? Los links que apunten a ella dejarán de funcionar.")) return;
    await fetch(`/api/admin/pages/${initial.id}`, { method: "DELETE" });
    router.push("/admin/pages");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760 }}>
      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="page_event">Evento</label>
        <select id="page_event" value={values.eventId} onChange={(e) => set("eventId", e.target.value)}>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="page_title">Título</label>
        <input id="page_title" value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej: Cronograma de demostraciones" />
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="page_slug">Dirección de la página</label>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#5b5f6b" }}>
            {siteOrigin.replace(/^https?:\/\//, "")}/{event?.slug ?? "…"}/
          </span>
          <input
            id="page_slug"
            value={values.slug}
            onChange={(e) => set("slug", e.target.value)}
            placeholder="se arma sola con el título (ej: cronograma)"
            style={{ flex: "1 1 200px" }}
          />
        </div>
        {publicUrl && (
          <a href={publicUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
            {values.published ? "Ver la página publicada ↗" : "Ver la vista previa (solo tú la ves mientras sea borrador) ↗"}
          </a>
        )}
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="page_intro">Texto de introducción (opcional)</label>
        <textarea id="page_intro" rows={2} value={values.intro} onChange={(e) => set("intro", e.target.value)} placeholder="Una o dos líneas debajo del título" />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={values.showRegisterButton} onChange={(e) => set("showRegisterButton", e.target.checked)} style={{ width: "auto" }} />
          Mostrar el botón &quot;Quiero mi entrada&quot; (lleva al formulario de inscripción del evento)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
          <input type="checkbox" checked={values.published} onChange={(e) => set("published", e.target.checked)} style={{ width: "auto" }} />
          Publicada (si no, es un borrador que solo ves tú)
        </label>
      </div>

      <div>
        <h2 style={{ fontSize: 16, margin: "8px 0 10px" }}>Contenido</h2>
        <LandingBlocksEditor blocks={values.blocks} onChange={(blocks) => set("blocks", blocks)} />
      </div>

      {error && <p style={{ color: "#c2185b", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", position: "sticky", bottom: 0, background: "var(--bg, #faf9f7)", padding: "12px 0" }}>
        <button type="submit" className="primary" disabled={saving} style={{ width: "auto", padding: "10px 22px" }}>
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear página"}
        </button>
        {isEdit && (
          <button type="button" className="secondary" onClick={handleDelete} style={{ width: "auto", padding: "10px 16px", color: "#c2185b" }}>
            Eliminar página
          </button>
        )}
      </div>
    </form>
  );
}
