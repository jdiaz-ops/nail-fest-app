"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zonedTimeToUtc } from "@/lib/dateFormat";

type EventStatus = "DRAFT" | "PUBLISHED";

export interface EventFormValues {
  id?: string;
  name: string;
  city: string;
  venueName: string;
  venueAddress: string;
  startsAtLocal: string; // "YYYY-MM-DDTHH:mm", already in `timezone`
  endsAtLocal: string;
  capacity: string; // kept as text in the form, parsed on submit
  status: EventStatus;
  slug: string;
}

export default function EventForm({
  initial,
  timezone,
  baseUrl,
}: {
  initial: EventFormValues;
  timezone: string;
  baseUrl: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial.id);

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const capacity = values.capacity.trim() ? Number(values.capacity) : null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity <= 0)) {
      setError("El cupo debe ser un número entero positivo.");
      setSaving(false);
      return;
    }

    const startsAt = zonedTimeToUtc(values.startsAtLocal, timezone);
    if (Number.isNaN(startsAt.getTime())) {
      setError("La fecha de inicio no es válida.");
      setSaving(false);
      return;
    }
    const endsAt = values.endsAtLocal ? zonedTimeToUtc(values.endsAtLocal, timezone) : null;

    const body = {
      name: values.name.trim(),
      city: values.city.trim(),
      venueName: values.venueName.trim(),
      venueAddress: values.venueAddress.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      capacity,
      status: values.status,
      slug: values.slug.trim() || undefined,
    };

    const res = await fetch(isEdit ? `/api/admin/events/${initial.id}` : "/api/admin/events", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSaving(false);
    if (res.ok) {
      router.push("/admin/events");
      router.refresh();
    } else {
      setError("No se pudo guardar el evento — revisa los campos.");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 640 }}>
      <div className="field">
        <label>Nombre del evento</label>
        <input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Nail Fest Cali - 5 & 6 Septiembre" required />
      </div>

      <div className="field">
        <label>Ciudad</label>
        <input value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Cali" required />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label>Lugar</label>
          <input value={values.venueName} onChange={(e) => set("venueName", e.target.value)} placeholder="Auditorio Lumen Unicatólica" />
        </div>
        <div className="field">
          <label>Dirección</label>
          <input value={values.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} placeholder="Carrera 94 # 4c – 120" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label>Empieza</label>
          <input type="datetime-local" value={values.startsAtLocal} onChange={(e) => set("startsAtLocal", e.target.value)} required />
        </div>
        <div className="field">
          <label>Termina (opcional)</label>
          <input type="datetime-local" value={values.endsAtLocal} onChange={(e) => set("endsAtLocal", e.target.value)} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: -12, marginBottom: 16 }}>
        Hora local de {timezone} (Configuración → Datos básicos).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="field">
          <label>Cupo (opcional)</label>
          <input
            type="number"
            min={1}
            value={values.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            placeholder="Sin límite si se deja vacío"
          />
        </div>
        <div className="field">
          <label>Estado</label>
          <select value={values.status} onChange={(e) => set("status", e.target.value as EventStatus)}>
            <option value="DRAFT">Draft — no visible al público</option>
            <option value="PUBLISHED">Published — página de registro activa</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>URL personalizada (opcional)</label>
        <input value={values.slug} onChange={(e) => set("slug", e.target.value)} placeholder="cali-2026" />
        <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
          {baseUrl}/{values.slug.trim() || (isEdit ? initial.slug : "se-genera-del-nombre")}
        </p>
      </div>

      {error && <p style={{ color: "#c2185b", fontSize: 13 }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: "10px 24px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear evento"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/events")}
          style={{ padding: "10px 24px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 14, cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
