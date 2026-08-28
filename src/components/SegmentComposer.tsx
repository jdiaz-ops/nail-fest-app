"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  events: { slug: string; name: string }[];
  professionOptions: string[];
}

export default function SegmentComposer({ events, professionOptions }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [includeEvent, setIncludeEvent] = useState("");
  const [includeCity, setIncludeCity] = useState("");
  const [includeProfession, setIncludeProfession] = useState("");
  const [excludeEvent, setExcludeEvent] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const include = [
      includeEvent ? { field: "event", eventSlug: includeEvent } : null,
      includeCity ? { field: "city", city: includeCity } : null,
      includeProfession ? { field: "profession", profession: includeProfession } : null,
    ].filter(Boolean);
    const exclude = [excludeEvent ? { field: "event", eventSlug: excludeEvent } : null].filter(Boolean);

    const res = await fetch("/api/admin/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, filter: { include, exclude } }),
    });
    setSaving(false);
    if (res.ok) {
      setResult("Segmento guardado — se sincroniza con Meta automáticamente en el próximo cron, sin nada más que hacer aquí.");
      setName("");
      setIncludeEvent("");
      setIncludeCity("");
      setIncludeProfession("");
      setExcludeEvent("");
      router.refresh();
    } else {
      setResult("Error al guardar — revisa la consola.");
    }
  }

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 520 }}>
      <h2>Nuevo segmento</h2>

      <div className="field">
        <label>Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Registrados Pereira 2026"
          required
        />
      </div>

      <fieldset style={{ marginTop: 12, marginBottom: 16, border: "1px solid #e3e1dc", borderRadius: 8, padding: 12 }}>
        <legend>Filtro</legend>

        <div className="field">
          <label>Incluir: registrados a este evento</label>
          <select value={includeEvent} onChange={(e) => setIncludeEvent(e.target.value)}>
            <option value="">(cualquiera)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Incluir: ciudad</label>
          <input value={includeCity} onChange={(e) => setIncludeCity(e.target.value)} placeholder="Bogotá" />
        </div>

        <div className="field">
          <label>Incluir: profesión</label>
          <select value={includeProfession} onChange={(e) => setIncludeProfession(e.target.value)}>
            <option value="">(cualquiera)</option>
            {professionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Excluir: registrados a este evento</label>
          <select value={excludeEvent} onChange={(e) => setExcludeEvent(e.target.value)}>
            <option value="">(ninguno)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 12 }}>
        Al guardar, este segmento queda vinculado a una Custom Audience en Meta con el mismo
        nombre. No hay botón de &quot;sincronizar&quot; — un cron lo mantiene actualizado solo,
        cada vez incluyendo solo a quienes dieron consentimiento de publicidad.
      </p>

      <button className="primary" type="submit" disabled={saving}>
        {saving ? "Guardando..." : "Guardar segmento"}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </form>
  );
}
