"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  events: { slug: string; name: string }[];
  professionOptions: string[];
}

export default function SegmentComposer({ events, professionOptions }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [includeEvent, setIncludeEvent] = useState("");
  const [includeAttended, setIncludeAttended] = useState("");
  const [includeCity, setIncludeCity] = useState("");
  const [includeProfession, setIncludeProfession] = useState("");
  const [excludeEvent, setExcludeEvent] = useState("");
  const [excludeAttended, setExcludeAttended] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const filter = useMemo(() => {
    const include = [
      includeEvent ? { field: "event", eventSlug: includeEvent } : null,
      includeAttended ? { field: "attended", eventSlug: includeAttended } : null,
      includeCity ? { field: "city", city: includeCity } : null,
      includeProfession ? { field: "profession", profession: includeProfession } : null,
    ].filter(Boolean);
    const exclude = [
      excludeEvent ? { field: "event", eventSlug: excludeEvent } : null,
      excludeAttended ? { field: "attended", eventSlug: excludeAttended } : null,
    ].filter(Boolean);
    return { include, exclude };
  }, [includeEvent, includeAttended, includeCity, includeProfession, excludeEvent, excludeAttended]);

  const hasAnyFilter = filter.include.length > 0 || filter.exclude.length > 0;
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Live count as the filter changes — debounced so typing a city name
  // doesn't fire a request per keystroke. Same resolveSegment() the real
  // sync uses, so this is the actual count, not an estimate.
  useEffect(() => {
    if (!hasAnyFilter) {
      setPreviewCount(null);
      return;
    }
    setPreviewLoading(true);
    const timer = setTimeout(async () => {
      const res = await fetch("/api/admin/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filter }),
      });
      const body = await res.json().catch(() => ({}));
      setPreviewCount(res.ok ? body.count : null);
      setPreviewLoading(false);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filter)]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setResult(null);

    const res = await fetch("/api/admin/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, filter }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      const first = body.firstSync;
      setResult(
        first?.status === "OK"
          ? `Segmento guardado y sincronizado con Meta de una vez — ${first.memberCount} personas ahora mismo. De aquí en adelante se mantiene solo (nuevos registros entran al toque; el cron reconcilia el resto).`
          : `Segmento guardado. La primera sincronización con Meta no se pudo completar ahora (${first?.error ?? "revisa /admin/meta"}) — el cron lo reintenta solo.`
      );
      setName("");
      setIncludeEvent("");
      setIncludeAttended("");
      setIncludeCity("");
      setIncludeProfession("");
      setExcludeEvent("");
      setExcludeAttended("");
      setPreviewCount(null);
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
          <label>Incluir: asistió (check-in real) a este evento</label>
          <select value={includeAttended} onChange={(e) => setIncludeAttended(e.target.value)}>
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

        <div className="field">
          <label>Excluir: asistió (check-in real) a este evento</label>
          <select value={excludeAttended} onChange={(e) => setExcludeAttended(e.target.value)}>
            <option value="">(ninguno)</option>
            {events.map((ev) => (
              <option key={ev.slug} value={ev.slug}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
        <p style={{ fontSize: 12, color: "#5b5f6b" }}>
          Ej: profesión = Manicurista, excluir asistió = Cali 2025 → &quot;manicuristas que no
          fueron a Cali 2025&quot; (usa asistencia real, no solo registro).
        </p>
      </fieldset>

      <div
        style={{
          background: "#f0efec",
          borderRadius: 8,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 14,
        }}
      >
        {!hasAnyFilter ? (
          <span style={{ color: "#5b5f6b" }}>Elige al menos un filtro para ver cuántas personas incluye.</span>
        ) : previewLoading ? (
          <span style={{ color: "#5b5f6b" }}>Calculando...</span>
        ) : previewCount !== null ? (
          <span>
            <strong>{previewCount}</strong> {previewCount === 1 ? "persona coincide" : "personas coinciden"} con
            este filtro ahora mismo.
          </span>
        ) : null}
      </div>

      <p style={{ fontSize: 13, color: "#5b5f6b", marginBottom: 12 }}>
        Al guardar, este segmento se sincroniza con Meta de inmediato (no hay que esperar al
        cron) y luego se mantiene solo — nuevos registros entran casi al instante, el resto se
        reconcilia en segundo plano.
      </p>

      <button className="primary" type="submit" disabled={saving}>
        {saving ? "Guardando..." : "Guardar segmento"}
      </button>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </form>
  );
}
