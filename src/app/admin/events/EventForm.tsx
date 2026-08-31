"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fraunces } from "next/font/google";
import { zonedTimeToUtc } from "@/lib/dateFormat";
import RichTextEditor from "@/components/RichTextEditor";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "900"] });

type EventStatus = "DRAFT" | "PUBLISHED";

export interface EventFormValues {
  id?: string;
  name: string;
  city: string;
  venueName: string;
  venueAddress: string;
  description: string;
  imageUrl: string | null;
  registerButtonLabel: string;
  startsAtLocal: string; // "YYYY-MM-DDTHH:mm", already in `timezone`
  endsAtLocal: string;
  capacity: string; // kept as text in the form, parsed on submit
  status: EventStatus;
  slug: string;
}

// What "Copiar detalles de..." (matching a "Copy event details from..."
// pattern from our previous ticketing platform) can carry over —
// everything EXCEPT dates and slug, which
// stay blank/auto so a copied event never accidentally goes live under
// the old event's dates or URL without the admin deliberately setting
// new ones.
export interface DuplicateSource {
  id: string;
  name: string;
  city: string;
  venueName: string;
  venueAddress: string;
  description: string;
  imageUrl: string | null;
  registerButtonLabel: string;
  capacity: string;
}

export default function EventForm({
  title,
  initial,
  timezone,
  baseUrl,
  duplicateFrom,
}: {
  title: string;
  initial: EventFormValues;
  timezone: string;
  baseUrl: string;
  // Only passed on the "new event" page — editing an existing event has
  // nothing to copy FROM, it already has its own values.
  duplicateFrom?: DuplicateSource[];
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(initial.id);
  const [urlCopied, setUrlCopied] = useState(false);

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function applyDuplicate(id: string) {
    const source = duplicateFrom?.find((d) => d.id === id);
    if (!source) return;
    setValues((v) => ({
      ...v,
      name: `${source.name} (copia)`,
      city: source.city,
      venueName: source.venueName,
      venueAddress: source.venueAddress,
      description: source.description,
      imageUrl: source.imageUrl,
      registerButtonLabel: source.registerButtonLabel,
      capacity: source.capacity,
      // Dates and slug deliberately NOT copied — a new event needs its
      // own, and silently reusing the old ones is exactly the kind of
      // mistake that ships a wrong date.
    }));
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads/event-image", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        set("imageUrl", body.url);
      } else {
        setUploadError(
          body?.error === "blob_not_configured"
            ? "El almacenamiento de imágenes no está activo todavía."
            : body?.error === "not_an_image"
              ? "Ese archivo no es una imagen."
              : body?.error === "too_large"
                ? "La imagen pesa más de 5MB."
                : "No se pudo subir la imagen."
        );
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
      description: values.description.trim(),
      imageUrl: values.imageUrl,
      registerButtonLabel: values.registerButtonLabel.trim(),
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
      const resBody = await res.json().catch(() => ({}));
      // On create, go straight into editing the new event (not the list)
      // so "Tickets and items" is reachable immediately — matches Ticket
      // Tailor's own flow, where "Add new event" drops you straight into
      // that event's edit screen instead of back to the events list.
      router.push(isEdit ? "/admin/events" : `/admin/events/${resBody.event.id}/edit`);
      router.refresh();
    } else {
      setError("No se pudo guardar el evento — revisa los campos.");
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 26, margin: 0 }}>
          {title}
        </h1>
        {!isEdit && duplicateFrom && duplicateFrom.length > 0 && (
          <div style={{ minWidth: 260 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5b5f6b", marginBottom: 4 }}>
              Copiar detalles de…
            </label>
            <select defaultValue="" onChange={(e) => applyDuplicate(e.target.value)} style={{ width: "100%" }}>
              <option value="" disabled>
                Empezar en blanco
              </option>
              {duplicateFrom.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {!isEdit && duplicateFrom && duplicateFrom.length > 0 && (
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: -12, marginBottom: 20, textAlign: "right" }}>
          Copia nombre, ciudad, lugar, descripción, imagen y cupo. Fecha y URL siempre quedan en blanco.
        </p>
      )}

      <form onSubmit={handleSubmit} style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12 }}>
        <Section title="Datos del evento">
          <div className="field">
            <label>Nombre del evento</label>
            <input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Nail Fest Cali - 5 & 6 Septiembre" required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Ciudad</label>
            <input value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Cali" required />
          </div>
        </Section>

        <Section title="Fechas">
          <Row>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Empieza</label>
              <input type="datetime-local" value={values.startsAtLocal} onChange={(e) => set("startsAtLocal", e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Termina (opcional)</label>
              <input type="datetime-local" value={values.endsAtLocal} onChange={(e) => set("endsAtLocal", e.target.value)} />
            </div>
          </Row>
          <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 10, marginBottom: 0 }}>
            Hora local de {timezone} (Configuración → Datos básicos).
          </p>
        </Section>

        <Section title="Ubicación">
          <Row>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Lugar</label>
              <input value={values.venueName} onChange={(e) => set("venueName", e.target.value)} placeholder="Auditorio Lumen Unicatólica" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Dirección</label>
              <input value={values.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} placeholder="Carrera 94 # 4c – 120" />
            </div>
          </Row>
        </Section>

        <Section title="Configuración">
          {/* Cupo (opcional) quitado — nunca limitó nada de verdad (solo
              alimentaba un número de "cupos restantes" en el admin), y ya
              no se muestra en ningún lado público desde que se quitó
              "Entrada gratuita. Cupo limitado" de la landing del evento.
              Eventos que ya tenían un valor guardado lo conservan (no se
              borra al guardar otros cambios), simplemente ya no se puede
              ver ni editar desde aquí. */}
          <Row>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Estado</label>
              <select value={values.status} onChange={(e) => set("status", e.target.value as EventStatus)}>
                <option value="DRAFT">Draft — no visible al público</option>
                <option value="PUBLISHED">Published — página activa</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>URL personalizada (opcional)</label>
              <input value={values.slug} onChange={(e) => set("slug", e.target.value)} placeholder="cali-2026" />
            </div>
          </Row>
          {(() => {
            const fullUrl = `${baseUrl}/${values.slug.trim() || (isEdit ? initial.slug : "se-genera-del-nombre")}`;
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: "var(--link)", wordBreak: "break-all" }}
                >
                  {fullUrl} ↗
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(fullUrl);
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 1500);
                  }}
                  style={{
                    fontSize: 12,
                    padding: "3px 10px",
                    borderRadius: 999,
                    border: "1px solid #e3e1dc",
                    background: "#fff",
                    cursor: "pointer",
                    color: "#1c1310",
                  }}
                >
                  {urlCopied ? "Copiado ✓" : "Copiar"}
                </button>
              </div>
            );
          })()}
        </Section>

        <Section title="Página del evento" last>
          <div className="field">
            <label>Description</label>
            <RichTextEditor value={values.description} onChange={(html) => set("description", html)} />
          </div>

          <div className="field">
            <label>Imagen de portada (opcional)</label>
            {values.imageUrl && (
              <div style={{ marginBottom: 8, position: "relative", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL, not a known-size asset */}
                <img
                  src={values.imageUrl}
                  alt="Portada del evento"
                  style={{ maxWidth: 320, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
                />
                <button
                  type="button"
                  onClick={() => set("imageUrl", null)}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    border: "none",
                    borderRadius: 999,
                    width: 24,
                    height: 24,
                    background: "rgba(28,19,16,0.7)",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                  aria-label="Quitar imagen"
                  title="Quitar imagen"
                >
                  ×
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} />
            {uploading && <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>Subiendo…</p>}
            {uploadError && <p style={{ fontSize: 12, color: "#c2185b", margin: "4px 0 0" }}>{uploadError}</p>}
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Select tickets button label</label>
            <input
              value={values.registerButtonLabel}
              onChange={(e) => set("registerButtonLabel", e.target.value)}
              placeholder="Registrarme GRATIS"
              style={{ maxWidth: 360 }}
            />
            <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
              El texto del botón de registro en la página pública del evento (no hay paso de
              &quot;elegir boleta&quot; en nuestro flujo, así que este botón manda directo al
              registro).
            </p>
          </div>
        </Section>

        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "20px 32px" }}>
          <button
            type="submit"
            disabled={saving || uploading}
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
          {error && (
            <p style={{ color: "#c2185b", fontSize: 13, margin: 0 }}>{error}</p>
          )}
        </div>
      </form>
    </div>
  );
}

// One visually distinct block per our previous ticketing platform's own
// "Event info" / "Dates" / "Location" / "Event page" grouping — a header, generous
// padding, and a full-width divider below (except the last section),
// instead of every field running together in one cramped column.
function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ padding: "24px 32px", borderBottom: last ? "none" : "1px solid #f0efec" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 18px" }}>{title}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  );
}

function Row({ children, columns = "1fr 1fr" }: { children: React.ReactNode; columns?: string }) {
  return (
    <div className="form-row" style={{ display: "grid", gridTemplateColumns: columns, gap: 24 }}>
      {children}
    </div>
  );
}
