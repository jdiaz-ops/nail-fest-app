"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeFilter, type SegmentFilter } from "@/lib/segments/normalize";
import { COUNTRY_CODES } from "@/lib/countryCodes";

// What editing an existing segment needs from the caller — the raw stored
// filter (either shape; normalizeFilter below handles pre-multi-select
// segments the same way the rest of the segment code already does) plus
// enough identity to PATCH the right row and show the right heading.
export interface EditingSegment {
  id: string;
  name: string;
  filter: unknown;
}

interface Props {
  events: { slug: string; name: string }[];
  professionOptions: string[];
  cityOptions: string[];
  labelOptions: string[];
  // Present = edit an existing segment instead of creating a new one.
  // Caller (SegmentsAdminClient) owns which segment is being edited and
  // clears this back to undefined on cancel/save.
  editingSegment?: EditingSegment | null;
  onDone?: () => void;
}

// A checkbox list, not a native <select multiple> — ctrl/cmd-click to
// multi-select is not something most admins here would discover on their
// own, checkboxes are unambiguous. Used 8 times below (event/attended/
// city/profession × incluir/excluir), one shared component instead of
// repeating the markup.
function MultiCheckList({
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }
  if (options.length === 0) {
    return <p style={{ fontSize: 13, color: "#8a8478", margin: "4px 0" }}>{emptyLabel}</p>;
  }
  return (
    <div
      style={{
        maxHeight: 140,
        overflowY: "auto",
        border: "1px solid #e3e1dc",
        borderRadius: 8,
        padding: 8,
        background: "#fff",
      }}
    >
      {options.map((opt) => (
        <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 4px", fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

// Pulls one field's values out of a normalized filter's include/exclude
// list — a segment only ever has at most one condition per field (see
// the `filter` useMemo below), so this is just "find it or return []".
function extract(conditions: SegmentFilter["include"], field: string, key: string): string[] {
  const found = conditions.find((c) => c.field === field) as Record<string, unknown> | undefined;
  return (found?.[key] as string[] | undefined) ?? [];
}

const emptyForm = {
  name: "",
  includeEvent: [] as string[],
  includeAttended: [] as string[],
  includeCity: [] as string[],
  includeProfession: [] as string[],
  includeLabel: [] as string[],
  includePhoneCountry: [] as string[],
  excludeEvent: [] as string[],
  excludeAttended: [] as string[],
  excludeCity: [] as string[],
  excludeProfession: [] as string[],
  excludeLabel: [] as string[],
  excludePhoneCountry: [] as string[],
};

export default function SegmentComposer({ events, professionOptions, cityOptions, labelOptions, editingSegment, onDone }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [includeEvent, setIncludeEvent] = useState<string[]>([]);
  const [includeAttended, setIncludeAttended] = useState<string[]>([]);
  const [includeCity, setIncludeCity] = useState<string[]>([]);
  const [includeProfession, setIncludeProfession] = useState<string[]>([]);
  const [includeLabel, setIncludeLabel] = useState<string[]>([]);
  const [includePhoneCountry, setIncludePhoneCountry] = useState<string[]>([]);
  const [excludeEvent, setExcludeEvent] = useState<string[]>([]);
  const [excludeAttended, setExcludeAttended] = useState<string[]>([]);
  const [excludeCity, setExcludeCity] = useState<string[]>([]);
  const [excludeProfession, setExcludeProfession] = useState<string[]>([]);
  const [excludeLabel, setExcludeLabel] = useState<string[]>([]);
  const [excludePhoneCountry, setExcludePhoneCountry] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const isEditing = !!editingSegment;

  // Pre-fill the form when the caller sets (or switches) which segment is
  // being edited — and reset back to blank when it clears (Cancelar, or
  // after a successful save). Runs off editingSegment.id specifically, not
  // the whole object, so it doesn't re-run on every parent re-render.
  useEffect(() => {
    if (!editingSegment) {
      setName(emptyForm.name);
      setIncludeEvent(emptyForm.includeEvent);
      setIncludeAttended(emptyForm.includeAttended);
      setIncludeCity(emptyForm.includeCity);
      setIncludeProfession(emptyForm.includeProfession);
      setIncludeLabel(emptyForm.includeLabel);
      setIncludePhoneCountry(emptyForm.includePhoneCountry);
      setExcludeEvent(emptyForm.excludeEvent);
      setExcludeAttended(emptyForm.excludeAttended);
      setExcludeCity(emptyForm.excludeCity);
      setExcludeProfession(emptyForm.excludeProfession);
      setExcludeLabel(emptyForm.excludeLabel);
      setExcludePhoneCountry(emptyForm.excludePhoneCountry);
      return;
    }
    const normalized = normalizeFilter(editingSegment.filter as SegmentFilter);
    setName(editingSegment.name);
    setIncludeEvent(extract(normalized.include, "event", "eventSlugs"));
    setIncludeAttended(extract(normalized.include, "attended", "eventSlugs"));
    setIncludeCity(extract(normalized.include, "city", "cities"));
    setIncludeProfession(extract(normalized.include, "profession", "professions"));
    setIncludeLabel(extract(normalized.include, "label", "labels"));
    setIncludePhoneCountry(extract(normalized.include, "phoneCountry", "codes"));
    setExcludeEvent(extract(normalized.exclude, "event", "eventSlugs"));
    setExcludeAttended(extract(normalized.exclude, "attended", "eventSlugs"));
    setExcludeCity(extract(normalized.exclude, "city", "cities"));
    setExcludeProfession(extract(normalized.exclude, "profession", "professions"));
    setExcludeLabel(extract(normalized.exclude, "label", "labels"));
    setExcludePhoneCountry(extract(normalized.exclude, "phoneCountry", "codes"));
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSegment?.id]);

  // Within one condition (e.g. varias ciudades) the values are OR'd — a
  // real SQL IN — since that's a single field's own condition. Across
  // DIFFERENT fields in "incluir" they're AND'd (unchanged): "ciudad =
  // Bogotá o Pereira" Y "profesión = Manicurista o Estudiante" is
  // genuinely two separate conditions, intersected. "excluir" stays a
  // flat blocklist — match ANY excluded condition, of any field, and
  // you're out.
  const filter = useMemo(() => {
    const include = [
      includeEvent.length ? { field: "event", eventSlugs: includeEvent } : null,
      includeAttended.length ? { field: "attended", eventSlugs: includeAttended } : null,
      includeCity.length ? { field: "city", cities: includeCity } : null,
      includeProfession.length ? { field: "profession", professions: includeProfession } : null,
      includeLabel.length ? { field: "label", labels: includeLabel } : null,
      includePhoneCountry.length ? { field: "phoneCountry", codes: includePhoneCountry } : null,
    ].filter(Boolean);
    const exclude = [
      excludeEvent.length ? { field: "event", eventSlugs: excludeEvent } : null,
      excludeAttended.length ? { field: "attended", eventSlugs: excludeAttended } : null,
      excludeCity.length ? { field: "city", cities: excludeCity } : null,
      excludeProfession.length ? { field: "profession", professions: excludeProfession } : null,
      excludeLabel.length ? { field: "label", labels: excludeLabel } : null,
      excludePhoneCountry.length ? { field: "phoneCountry", codes: excludePhoneCountry } : null,
    ].filter(Boolean);
    return { include, exclude };
  }, [
    includeEvent,
    includeAttended,
    includeCity,
    includeProfession,
    includeLabel,
    includePhoneCountry,
    excludeEvent,
    excludeAttended,
    excludeCity,
    excludeProfession,
    excludeLabel,
    excludePhoneCountry,
  ]);

  const hasAnyFilter = filter.include.length > 0 || filter.exclude.length > 0;
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Live count as the filter changes — debounced so ticking several
  // checkboxes in a row doesn't fire a request per click. Same
  // resolveSegment() the real sync uses, so this is the actual count, not
  // an estimate.
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

    const res = isEditing
      ? await fetch("/api/admin/segments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingSegment!.id, name, filter }),
        })
      : await fetch("/api/admin/segments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, filter }),
        });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      const sync = isEditing ? body.resync : body.firstSync;
      const verb = isEditing ? "actualizado" : "guardado";
      setResult(
        sync?.status === "OK" || "memberCount" in (sync ?? {})
          ? `Segmento ${verb} y sincronizado con Meta de una vez — ${sync.memberCount} personas ahora mismo. De aquí en adelante se mantiene solo (nuevos registros entran al toque; el cron reconcilia el resto).`
          : `Segmento ${verb}. La sincronización con Meta no se pudo completar ahora (${sync?.error ?? "revisa /admin/settings/integrations"}) — el cron lo reintenta solo.`
      );
      setPreviewCount(null);
      if (isEditing) {
        onDone?.();
      } else {
        setName("");
        setIncludeEvent([]);
        setIncludeAttended([]);
        setIncludeCity([]);
        setIncludeProfession([]);
        setIncludeLabel([]);
        setIncludePhoneCountry([]);
        setExcludeEvent([]);
        setExcludeAttended([]);
        setExcludeCity([]);
        setExcludeProfession([]);
        setExcludeLabel([]);
        setExcludePhoneCountry([]);
      }
      router.refresh();
    } else {
      setResult("Error al guardar — revisa la consola.");
    }
  }

  const eventOptions = events.map((ev) => ({ value: ev.slug, label: ev.name }));
  const professionCheckOptions = professionOptions.map((p) => ({ value: p, label: p }));
  const cityCheckOptions = cityOptions.map((c) => ({ value: c, label: c }));
  const labelCheckOptions = labelOptions.map((l) => ({ value: l, label: l }));
  // Static, not DB-driven like the others — every phone country a person
  // could actually register with (see src/lib/countryCodes.ts) is a valid
  // filter value regardless of whether anyone's used it yet.
  const phoneCountryCheckOptions = COUNTRY_CODES.map((c) => ({ value: c.code, label: c.label }));

  return (
    <form onSubmit={handleSave} style={{ maxWidth: 900 }}>
      <h2>{isEditing ? `Editar segmento: ${editingSegment!.name}` : "Nuevo segmento"}</h2>
      {isEditing && (
        <p style={{ fontSize: 13, color: "#5b5f6b", marginTop: -8, marginBottom: 16 }}>
          Los cambios se sincronizan con la Custom Audience en Meta de inmediato al guardar — si cambia el filtro,
          cambia quién está en la audiencia; si cambia el nombre, se renombra la misma audiencia en Meta (no se crea
          una nueva).
        </p>
      )}

      <div className="field">
        <label>Nombre</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Registrados Pereira 2026"
          required
        />
      </div>

      <fieldset style={{ marginTop: 12, marginBottom: 16, border: "1px solid #e3e1dc", borderRadius: 8, padding: 16 }}>
        <legend>Filtro</legend>
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>
          Marca varias opciones en un mismo campo para un &quot;o&quot; entre ellas (ej. Bogotá o Pereira). Entre
          campos distintos es un &quot;y&quot; (ej. esa ciudad Y esa profesión).
        </p>

        {/* Incluir / Excluir side by side — same reasoning as BroadcastComposer. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              Incluir
            </div>
            <div className="field">
              <label>Registrados a estos eventos</label>
              <MultiCheckList options={eventOptions} selected={includeEvent} onChange={setIncludeEvent} emptyLabel="No hay eventos todavía." />
            </div>
            <div className="field">
              <label>Asistió (check-in real) a estos eventos</label>
              <MultiCheckList options={eventOptions} selected={includeAttended} onChange={setIncludeAttended} emptyLabel="No hay eventos todavía." />
            </div>
            <div className="field">
              <label>Ciudad</label>
              <MultiCheckList options={cityCheckOptions} selected={includeCity} onChange={setIncludeCity} emptyLabel="Todavía no hay ciudades registradas." />
            </div>
            <div className="field">
              <label>Profesión</label>
              <MultiCheckList options={professionCheckOptions} selected={includeProfession} onChange={setIncludeProfession} emptyLabel="No hay profesiones configuradas." />
            </div>
            <div className="field">
              <label>Etiqueta</label>
              <MultiCheckList options={labelCheckOptions} selected={includeLabel} onChange={setIncludeLabel} emptyLabel="Todavía no hay etiquetas creadas." />
            </div>
            <div className="field">
              <label>País (código telefónico)</label>
              <MultiCheckList options={phoneCountryCheckOptions} selected={includePhoneCountry} onChange={setIncludePhoneCountry} emptyLabel="" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              Excluir
            </div>
            <div className="field">
              <label>Registrados a estos eventos</label>
              <MultiCheckList options={eventOptions} selected={excludeEvent} onChange={setExcludeEvent} emptyLabel="No hay eventos todavía." />
            </div>
            <div className="field">
              <label>Asistió (check-in real) a estos eventos</label>
              <MultiCheckList options={eventOptions} selected={excludeAttended} onChange={setExcludeAttended} emptyLabel="No hay eventos todavía." />
            </div>
            <div className="field">
              <label>Ciudad</label>
              <MultiCheckList options={cityCheckOptions} selected={excludeCity} onChange={setExcludeCity} emptyLabel="Todavía no hay ciudades registradas." />
            </div>
            <div className="field">
              <label>Profesión</label>
              <MultiCheckList options={professionCheckOptions} selected={excludeProfession} onChange={setExcludeProfession} emptyLabel="No hay profesiones configuradas." />
            </div>
            <div className="field">
              <label>Etiqueta</label>
              <MultiCheckList options={labelCheckOptions} selected={excludeLabel} onChange={setExcludeLabel} emptyLabel="Todavía no hay etiquetas creadas." />
            </div>
            <div className="field">
              <label>País (código telefónico)</label>
              <MultiCheckList options={phoneCountryCheckOptions} selected={excludePhoneCountry} onChange={setExcludePhoneCountry} emptyLabel="" />
            </div>
          </div>
        </div>

        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 8, marginBottom: 0 }}>
          Ej: incluir ciudad = Bogotá o Pereira, incluir profesión = Manicurista o Estudiante, excluir asistió = Cali
          2025 → &quot;manicuristas o estudiantes de Bogotá o Pereira que no fueron a Cali 2025&quot; (usa
          asistencia real, no solo registro).
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

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="primary" type="submit" disabled={saving} style={{ width: "auto", padding: "10px 24px" }}>
          {saving ? "Guardando..." : isEditing ? "Guardar cambios" : "Guardar segmento"}
        </button>
        {isEditing && (
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={() => {
              setResult(null);
              onDone?.();
            }}
            style={{ width: "auto", padding: "10px 24px" }}
          >
            Cancelar
          </button>
        )}
      </div>
      {result && <p style={{ marginTop: 12 }}>{result}</p>}
    </form>
  );
}
