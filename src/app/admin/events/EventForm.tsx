"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fraunces } from "next/font/google";
import { zonedTimeToUtc } from "@/lib/dateFormat";
import RichTextEditor from "@/components/RichTextEditor";
import LandingBlocksEditor from "./LandingBlocksEditor";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { compressImage } from "@/lib/imageCompression";
import { uploadMany } from "@/lib/uploadMany";
import { optimizedSrc } from "@/lib/optimizedImage";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "900"] });

type EventStatus = "DRAFT" | "PUBLISHED";
type EventFormat = "IN_PERSON" | "VIRTUAL" | "HYBRID";

export interface EventFormValues {
  id?: string;
  name: string;
  // Optional one-line tagline shown on the public page between the
  // event's name (h1) and its venue/address line — see [eventSlug]/page.tsx.
  subtitle: string;
  city: string;
  // IN_PERSON (default) shows Ubicación below; VIRTUAL replaces it with
  // Acceso virtual; HYBRID shows both (an in-person feria that also
  // sells a livestream pass).
  format: EventFormat;
  virtualAccessInstructions: string;
  zoomMeetingId: string;
  zoomIsWebinar: boolean;
  venueName: string;
  venueAddress: string;
  description: string;
  // See Event.landingBlocks/useLandingBlocks's own schema comments —
  // LandingBlocksEditor.tsx below edits landingBlocks; useLandingBlocks
  // is the switch between it and the plain `description` field above.
  landingBlocks: LandingBlock[];
  useLandingBlocks: boolean;
  imageUrl: string | null;
  // See Event.galleryImageUrls's own schema comment.
  galleryImageUrls: string[];
  galleryTitle: string;
  ctaNote: string;
  closingText: string;
  registerButtonLabel: string;
  startsAtLocal: string; // "YYYY-MM-DDTHH:mm", already in `timezone`
  endsAtLocal: string;
  // "El horario es diferente según el evento, la ciudad, etc." — real
  // per-day open/close times (see lib/eventSchedule.ts), each pair
  // already in `timezone` same as startsAtLocal/endsAtLocal above.
  // Empty (the default) means "not configured" — the confirmation
  // email/ticket/public page all keep showing the old single
  // startsAtLocal–endsAtLocal range in that case.
  scheduleDays: { opensAtLocal: string; closesAtLocal: string }[];
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
  subtitle: string;
  city: string;
  format: EventFormat;
  virtualAccessInstructions: string;
  venueName: string;
  venueAddress: string;
  description: string;
  landingBlocks: LandingBlock[];
  useLandingBlocks: boolean;
  imageUrl: string | null;
  galleryImageUrls: string[];
  galleryTitle: string;
  ctaNote: string;
  closingText: string;
  registerButtonLabel: string;
  capacity: string;
}

type TabId = "informacion" | "pagina" | "entradas" | "publicacion";
const TABS: { id: TabId; label: string }[] = [
  { id: "informacion", label: "Información" },
  { id: "pagina", label: "Página pública" },
  { id: "entradas", label: "Entradas" },
  { id: "publicacion", label: "Publicación" },
];

type CardId = "portada" | "bajada" | "boton" | "carrusel" | "contenido" | "cierre";

// The event editor: a bar pinned on top (name, Borrador/Publicado, unsaved
// changes, Ver página, Guardar) over four tabs — Información (what rarely
// changes), Página pública (every piece of the public page, in the order
// it appears there), Entradas (ticket types — they save on their own, see
// TicketTypesSection) and Publicación (status, address, duplicate/delete).
export default function EventForm({
  title,
  initial,
  timezone,
  baseUrl,
  duplicateFrom,
  ticketsSlot,
  publicationActions,
}: {
  title: string;
  initial: EventFormValues;
  timezone: string;
  baseUrl: string;
  // Only passed on the "new event" page — editing an existing event has
  // nothing to copy FROM, it already has its own values.
  duplicateFrom?: DuplicateSource[];
  // The Entradas tab's content (TicketTypesSection) — only for an event
  // that already exists, since ticket types hang off its id.
  ticketsSlot?: React.ReactNode;
  // Duplicate / delete buttons for the Publicación tab (existing events).
  publicationActions?: React.ReactNode;
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryProgress, setGalleryProgress] = useState<{ done: number; total: number } | null>(null);
  const [galleryUploadError, setGalleryUploadError] = useState<string | null>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(initial.id);
  const [urlCopied, setUrlCopied] = useState(false);
  const [tab, setTab] = useState<TabId>(isEdit ? "pagina" : "informacion");
  const [openCards, setOpenCards] = useState<Set<CardId>>(() => new Set(["contenido"]));
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = JSON.stringify(values) !== baseline;

  // The tab lives in the address (#pagina…) so a reload, or a link from
  // elsewhere in the admin, lands on the same one.
  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as TabId;
    if (TABS.some((t) => t.id === fromHash)) setTab(fromHash);
  }, []);
  function goToTab(id: TabId) {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
  }

  // Leaving with unsaved edits (closing the tab, reloading) asks first.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    // Same for an in-app link (the admin sidebar, the event menu) — those
    // navigate client-side, so beforeunload never fires for them.
    function onLinkClick(e: MouseEvent) {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (!confirm("Tienes cambios sin guardar. ¿Salir sin guardar?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [dirty]);

  function toggleCard(id: CardId) {
    setOpenCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // The classic free-text description becomes the first "Texto" block, and
  // the page switches to blocks — see the Contenido card.
  function moveDescriptionToBlocks() {
    setValues((v) => ({
      ...v,
      landingBlocks: v.description.trim() ? [{ type: "text", html: v.description }, ...v.landingBlocks] : v.landingBlocks,
      useLandingBlocks: true,
    }));
  }

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function applyDuplicate(id: string) {
    const source = duplicateFrom?.find((d) => d.id === id);
    if (!source) return;
    setValues((v) => ({
      ...v,
      name: `${source.name} (copia)`,
      subtitle: source.subtitle,
      city: source.city,
      format: source.format,
      virtualAccessInstructions: source.virtualAccessInstructions,
      venueName: source.venueName,
      venueAddress: source.venueAddress,
      description: source.description,
      landingBlocks: source.landingBlocks,
      useLandingBlocks: source.useLandingBlocks,
      imageUrl: source.imageUrl,
      galleryImageUrls: source.galleryImageUrls,
      galleryTitle: source.galleryTitle,
      ctaNote: source.ctaNote,
      closingText: source.closingText,
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
      // This is the public event page's hero — the single most-loaded
      // image in the app — and admins upload straight from a phone/camera
      // (multi-MB, way bigger than any screen needs). Compressing here,
      // before the file ever leaves the browser, guarantees a lean file
      // in Blob storage regardless of what next/image's on-request
      // optimizer does with it later — measured via PageSpeed Insights on
      // a throttled connection: an uncompressed banner alone was costing
      // ~3.4MB and pushing LCP past 6s. Larger dimension/higher quality
      // than the comprobantes default (imageCompression.ts) since this is
      // the main marketing visual, not a receipt scan, and the page's own
      // `sizes` hint requests up to 1080px CSS-wide (up to ~3x that in
      // device pixels on a dense screen).
      const compressed = await compressImage(file, { maxDimension: 2400, quality: 0.85 });
      const form = new FormData();
      form.append("file", compressed);
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

  // The public page's own carousel (see EventGalleryCarousel.tsx) shows
  // these constrained to a card width, never full-bleed like the hero —
  // same reasoning as RichTextEditor.tsx's own content-image compression,
  // smaller target than the hero's.
  async function handleGalleryImageAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (galleryFileInputRef.current) galleryFileInputRef.current.value = "";
    if (files.length === 0) return;
    setGalleryUploading(true);
    setGalleryUploadError(null);
    setGalleryProgress({ done: 0, total: files.length });
    const { values: urls, failed } = await uploadMany(
      files,
      async (file) => {
        const compressed = await compressImage(file, { maxDimension: 1600, quality: 0.85 });
        const form = new FormData();
        form.append("file", compressed);
        const res = await fetch("/api/admin/uploads/event-image", { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        if (res.ok) return { ok: true, value: body.url as string };
        return {
          ok: false,
          error:
            body?.error === "blob_not_configured"
              ? "El almacenamiento de imágenes no está activo todavía."
              : body?.error === "not_an_image"
                ? "Ese archivo no es una imagen."
                : body?.error === "too_large"
                  ? "La imagen pesa más de 5MB."
                  : "No se pudo subir la imagen.",
        };
      },
      (done, total) => setGalleryProgress({ done, total })
    );
    setValues((v) => ({ ...v, galleryImageUrls: [...v.galleryImageUrls, ...urls] }));
    setGalleryUploading(false);
    setGalleryProgress(null);
    if (failed.length > 0) setGalleryUploadError(`No se pudieron subir ${failed.length}: ${failed.join(" · ")}`);
  }

  function removeGalleryImage(index: number) {
    set(
      "galleryImageUrls",
      values.galleryImageUrls.filter((_, i) => i !== index)
    );
  }

  function moveGalleryImage(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= values.galleryImageUrls.length) return;
    const next = [...values.galleryImageUrls];
    [next[index], next[target]] = [next[target]!, next[index]!];
    set("galleryImageUrls", next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // The form spans tabs, so the browser's own "required" bubbles can't
    // point at a field that's on a hidden tab — check here and jump there.
    const missing = !values.name.trim() ? "el nombre" : !values.city.trim() ? "la ciudad" : !values.startsAtLocal ? "la fecha de inicio" : null;
    if (missing) {
      goToTab("informacion");
      setError(`Falta ${missing} (pestaña Información).`);
      return;
    }
    setSaving(true);

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

    // Every day row needs BOTH times filled to count — a half-filled row
    // (admin started adding a day, then changed their mind) is silently
    // dropped rather than rejected, since this whole section is optional.
    const scheduleDays: { opensAt: string; closesAt: string }[] = [];
    for (const day of values.scheduleDays) {
      if (!day.opensAtLocal || !day.closesAtLocal) continue;
      const opensAt = zonedTimeToUtc(day.opensAtLocal, timezone);
      const closesAt = zonedTimeToUtc(day.closesAtLocal, timezone);
      if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
        setError("Uno de los horarios por día no es válido.");
        setSaving(false);
        return;
      }
      scheduleDays.push({ opensAt: opensAt.toISOString(), closesAt: closesAt.toISOString() });
    }

    const body = {
      name: values.name.trim(),
      subtitle: values.subtitle.trim(),
      city: values.city.trim(),
      format: values.format,
      virtualAccessInstructions: values.virtualAccessInstructions.trim(),
      zoomMeetingId: values.zoomMeetingId.trim(),
      zoomIsWebinar: values.zoomIsWebinar,
      venueName: values.venueName.trim(),
      venueAddress: values.venueAddress.trim(),
      description: values.description.trim(),
      landingBlocks: values.landingBlocks,
      useLandingBlocks: values.useLandingBlocks,
      imageUrl: values.imageUrl,
      galleryImageUrls: values.galleryImageUrls,
      galleryTitle: values.galleryTitle.trim(),
      ctaNote: values.ctaNote.trim(),
      closingText: values.closingText.trim(),
      registerButtonLabel: values.registerButtonLabel.trim(),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      capacity,
      scheduleDays,
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
      if (isEdit) {
        // Stay on the same tab — the editor is where the next change
        // happens too; the bar shows "Guardado ✓" instead.
        setBaseline(JSON.stringify(values));
        setSavedAt(Date.now());
        router.refresh();
      } else {
        // A brand-new event goes straight into its own editor, on the
        // Página pública tab, with its tickets now reachable.
        router.push(`/admin/events/${resBody.event.id}/edit#pagina`);
        router.refresh();
      }
    } else {
      setError("No se pudo guardar el evento — revisa los campos.");
    }
  }


  const formId = `event-form-${initial.id ?? "new"}`;
  const fullUrl = `${baseUrl}/${values.slug.trim() || (isEdit ? initial.slug : "se-genera-del-nombre")}`;
  const published = values.status === "PUBLISHED";
  const canDuplicate = !isEdit && duplicateFrom && duplicateFrom.length > 0;

  const cardSummaries: Record<CardId, string> = {
    portada: values.imageUrl ? "Imagen cargada ✓" : "Sin imagen",
    bajada: plainPreview(values.subtitle) || "Vacía",
    boton: `“${values.registerButtonLabel.trim() || "Registrarme GRATIS"}”${values.ctaNote.trim() ? " + texto debajo" : ""}`,
    carrusel:
      values.galleryImageUrls.length > 0
        ? `${values.galleryTitle.trim() ? `“${values.galleryTitle.trim()}” · ` : ""}${values.galleryImageUrls.length} ${values.galleryImageUrls.length === 1 ? "foto" : "fotos"}`
        : "Sin fotos (no aparece)",
    contenido: values.useLandingBlocks
      ? `${values.landingBlocks.length} ${values.landingBlocks.length === 1 ? "bloque" : "bloques"}${
          values.landingBlocks.some((b) => b.hidden) ? ` · ${values.landingBlocks.filter((b) => b.hidden).length} oculto(s)` : ""
        }`
      : "Modo clásico (descripción)",
    cierre: values.closingText.trim() || "Automática con la fecha y la ciudad",
  };

  function card(id: CardId, n: number, label: string, children: React.ReactNode) {
    const open = openCards.has(id);
    return (
      <div className="ef-card" style={{ border: "1px solid #e3e1dc", borderRadius: 10, background: "#fff", overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => toggleCard(id)}
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "14px 16px",
            border: "none",
            background: open ? "#faf9f7" : "#fff",
            cursor: "pointer",
            textAlign: "left",
            color: "#1c1310",
          }}
        >
          <span
            style={{
              flexShrink: 0,
              width: 24,
              height: 24,
              borderRadius: 999,
              background: "#e6f9f7",
              color: "#0b2e2c",
              fontSize: 12,
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {n}
          </span>
          <span style={{ fontWeight: 600, fontSize: 15, flexShrink: 0 }}>{label}</span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 13,
              color: "#5b5f6b",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {cardSummaries[id]}
          </span>
          <span aria-hidden style={{ flexShrink: 0, color: "#8a8478", fontSize: 12 }}>
            {open ? "▲" : "▼"}
          </span>
        </button>
        {open && (
          <div style={{ padding: "4px 16px 18px", borderTop: "1px solid #f0efec", display: "flex", flexDirection: "column", gap: 14 }}>
            {children}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {!isEdit && (
        <h1 className={fraunces.className} style={{ fontWeight: 900, fontSize: 26, margin: "0 0 16px" }}>
          {title}
        </h1>
      )}

      {/* ── Barra fija ───────────────────────────────────────────── */}
        <div
          className="ef-bar"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "#fff",
            border: "1px solid #e3e1dc",
            borderRadius: 12,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            boxShadow: "0 2px 8px rgba(28,19,16,0.05)",
          }}
        >
          <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {values.name.trim() || (isEdit ? "Sin nombre" : "Nuevo evento")}
            </strong>
            <button
              type="button"
              onClick={() => set("status", published ? "DRAFT" : "PUBLISHED")}
              title="Cambiar estado (se aplica al guardar)"
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: published ? "#e6f9f7" : "#f3f1ec",
                color: published ? "#0b6b4f" : "#5b5f6b",
              }}
            >
              ● {published ? "Publicado" : "Borrador"} ▾
            </button>
            {dirty ? (
              <span style={{ fontSize: 12, color: "#b25e00", fontWeight: 600 }}>Cambios sin guardar</span>
            ) : savedAt ? (
              <span style={{ fontSize: 12, color: "#12966b" }}>Guardado ✓</span>
            ) : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isEdit && (
              <a
                href={`${baseUrl}/${initial.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 13,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid #e3e1dc",
                  color: "#1c1310",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Ver página ↗
              </a>
            )}
            <button
              type="submit"
              form={formId}
              disabled={saving || uploading || galleryUploading}
              style={{
                padding: "9px 20px",
                borderRadius: 999,
                border: "none",
                background: "#12966b",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                opacity: saving || uploading || galleryUploading ? 0.6 : 1,
              }}
            >
              {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear evento"}
            </button>
          </div>
          {error && <p style={{ flexBasis: "100%", color: "#c2185b", fontSize: 13, margin: 0 }}>{error}</p>}
        </div>

        {/* ── Pestañas ─────────────────────────────────────────────── */}
        <div
          role="tablist"
          className="ef-tabs"
          style={{ display: "flex", gap: 4, margin: "16px 0", borderBottom: "1px solid #e3e1dc", overflowX: "auto", WebkitOverflowScrolling: "touch" }}
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goToTab(t.id)}
                style={{
                  flexShrink: 0,
                  padding: "10px 16px",
                  border: "none",
                  borderBottom: `2px solid ${active ? "#12966b" : "transparent"}`,
                  marginBottom: -1,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? "#0b2e2c" : "#5b5f6b",
                  whiteSpace: "nowrap",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <form id={formId} onSubmit={handleSubmit} noValidate>
          {/* ── Información ──────────────────────────────────────────── */}
          <div role="tabpanel" style={{ display: tab === "informacion" ? "block" : "none" }}>
            <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12 }}>
              {canDuplicate && (
                <div style={{ padding: "20px 32px", borderBottom: "1px solid #f0efec", background: "#faf9f7", borderRadius: "12px 12px 0 0" }}>
                  <div className="field" style={{ marginBottom: 0, maxWidth: 420 }}>
                    <label>Copiar detalles de…</label>
                    <select defaultValue="" onChange={(e) => applyDuplicate(e.target.value)}>
                      <option value="" disabled>
                        Empezar en blanco
                      </option>
                      {duplicateFrom!.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
                      Copia nombre, ciudad, lugar, página pública e imagen. Fechas y URL siempre quedan en blanco.
                    </p>
                  </div>
                </div>
              )}

              <Section title="El evento">
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Nombre del evento</label>
                  <input value={values.name} onChange={(e) => set("name", e.target.value)} placeholder="Nail Fest Cali" required />
                  <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
                    Sin la fecha — la página pública la muestra aparte, en grande.
                  </p>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Ciudad</label>
                  <input value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Cali" required style={{ maxWidth: 360 }} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Formato</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(
                      [
                        ["IN_PERSON", "Presencial", "lugar y dirección"],
                        ["VIRTUAL", "Virtual", "por Zoom"],
                        ["HYBRID", "Híbrido", "presencial + virtual"],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <ChoiceButton key={value} active={values.format === value} onClick={() => set("format", value)} label={label} hint={hint} />
                    ))}
                  </div>
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
                <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>Hora local de {timezone}.</p>
              </Section>

              <Section title="Horario por día (opcional)">
                <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>
                  Para eventos de varios días con horas distintas cada día — el correo de confirmación y el ticket muestran
                  cada día por separado en vez de un solo rango &quot;Empieza – Termina&quot;.
                </p>
                {values.scheduleDays.map((day, i) => (
                  <Row key={i}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Día {i + 1} — abre</label>
                      <input
                        type="datetime-local"
                        value={day.opensAtLocal}
                        onChange={(e) => {
                          const next = [...values.scheduleDays];
                          next[i] = { ...next[i]!, opensAtLocal: e.target.value };
                          set("scheduleDays", next);
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                        <label>Día {i + 1} — cierra</label>
                        <input
                          type="datetime-local"
                          value={day.closesAtLocal}
                          onChange={(e) => {
                            const next = [...values.scheduleDays];
                            next[i] = { ...next[i]!, closesAtLocal: e.target.value };
                            set("scheduleDays", next);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => set("scheduleDays", values.scheduleDays.filter((_, j) => j !== i))}
                        className="secondary"
                        style={{ width: "auto", padding: "8px 14px", marginBottom: 0 }}
                      >
                        Quitar
                      </button>
                    </div>
                  </Row>
                ))}
                <button
                  type="button"
                  onClick={() => set("scheduleDays", [...values.scheduleDays, { opensAtLocal: "", closesAtLocal: "" }])}
                  className="secondary"
                  style={{ width: "auto", padding: "8px 14px", alignSelf: "flex-start" }}
                >
                  + Agregar día
                </button>
              </Section>

              {values.format !== "VIRTUAL" && (
                <Section title="Ubicación" last={values.format === "IN_PERSON"}>
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
              )}

              {values.format !== "IN_PERSON" && (
                <Section title="Acceso virtual (Zoom)" last>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>ID de la reunión o el webinar de Zoom (opcional)</label>
                    <input
                      value={values.zoomMeetingId}
                      onChange={(e) => set("zoomMeetingId", e.target.value)}
                      placeholder="ej. 812345678"
                      style={{ maxWidth: 320 }}
                    />
                    <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
                      Vacío = no se registra a nadie en Zoom automáticamente (el correo de confirmación sale igual, solo sin
                      link de acceso). La reunión/webinar debe tener la aprobación de registro en &quot;Automática&quot;, no
                      &quot;Manual&quot; — si no, Zoom no devuelve el link personal.
                    </p>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                    <input type="checkbox" checked={values.zoomIsWebinar} onChange={(e) => set("zoomIsWebinar", e.target.checked)} />
                    Es un Webinar de Zoom (no una Reunión normal)
                  </label>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Instrucciones de acceso (se muestran en la página y en el correo)</label>
                    <textarea
                      value={values.virtualAccessInstructions}
                      onChange={(e) => set("virtualAccessInstructions", e.target.value)}
                      placeholder="Te llega tu link personal de acceso por correo antes del evento — es solo tuyo, no lo compartas."
                      rows={3}
                      style={{ width: "100%" }}
                    />
                  </div>
                </Section>
              )}
            </div>
          </div>

          {/* ── Página pública ───────────────────────────────────────── */}
          <div role="tabpanel" style={{ display: tab === "pagina" ? "block" : "none" }}>
            <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 12px" }}>
              En el mismo orden en que se ve la página, de arriba hacia abajo. Toca una sección para abrirla.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {card(
                "portada",
                1,
                "Portada",
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Imagen de portada (opcional)</label>
                  {values.imageUrl && (
                    <div style={{ marginBottom: 8, position: "relative", display: "inline-block", alignSelf: "flex-start" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL, not a known-size asset */}
                      <img
                        src={values.imageUrl}
                        alt="Portada del evento"
                        style={{ maxWidth: 320, maxHeight: 160, borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
                      />
                      <button
                        type="button"
                        onClick={() => set("imageUrl", null)}
                        style={removeButtonStyle(24)}
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
              )}

              {card(
                "bajada",
                2,
                "Bajada",
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Texto bajo el nombre (opcional)</label>
                  <RichTextEditor value={values.subtitle} onChange={(html) => set("subtitle", html)} />
                  <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
                    Sale justo debajo del nombre del evento y antes de la dirección. Vacío = no aparece.
                  </p>
                </div>
              )}

              {card(
                "boton",
                3,
                "Botón de inscripción",
                <>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Texto del botón</label>
                    <input
                      value={values.registerButtonLabel}
                      onChange={(e) => set("registerButtonLabel", e.target.value)}
                      placeholder="Registrarme GRATIS"
                      style={{ maxWidth: 360 }}
                    />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Texto debajo del botón (opcional)</label>
                    <input
                      value={values.ctaNote}
                      onChange={(e) => set("ctaNote", e.target.value)}
                      placeholder="Para manicuristas, estudiantes de manos y pies y aficionadas a las uñas"
                    />
                    <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
                      Una línea corta — para quién es el evento. Vacío = no aparece.
                    </p>
                  </div>
                </>
              )}

              {card(
                "carrusel",
                4,
                "Carrusel de fotos",
                <>
                  <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>
                    Sale justo debajo del botón de inscripción — la persona lo desliza con el dedo. Sube fotos ya diseñadas;
                    aquí solo se acomodan. Sin fotos, esta sección no aparece.
                  </p>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Título (opcional)</label>
                    <input
                      value={values.galleryTitle}
                      onChange={(e) => set("galleryTitle", e.target.value)}
                      placeholder="Lo que vas a vivir"
                      style={{ maxWidth: 360 }}
                    />
                  </div>
                  {values.galleryImageUrls.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {values.galleryImageUrls.map((url, i) => (
                        <div key={url + i} style={{ position: "relative" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an arbitrary uploaded URL */}
                          <img
                            src={optimizedSrc(url, 256)}
                            alt=""
                            loading="lazy"
                            style={{ width: 110, height: 110, objectFit: "cover", borderRadius: 8, display: "block", border: "1px solid #e3e1dc" }}
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(i)}
                            style={removeButtonStyle(22)}
                            aria-label="Quitar foto"
                            title="Quitar foto"
                          >
                            ×
                          </button>
                          <span
                            style={{
                              position: "absolute",
                              top: 4,
                              left: 4,
                              minWidth: 22,
                              height: 22,
                              padding: "0 6px",
                              borderRadius: 999,
                              background: "rgba(28,19,16,0.7)",
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 700,
                              lineHeight: "22px",
                              textAlign: "center",
                            }}
                          >
                            {i + 1}
                          </span>
                          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                            <button
                              type="button"
                              onClick={() => moveGalleryImage(i, -1)}
                              disabled={i === 0}
                              aria-label="Mover antes"
                              title="Mover antes"
                              style={galleryMoveButtonStyle}
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              onClick={() => moveGalleryImage(i, 1)}
                              disabled={i === values.galleryImageUrls.length - 1}
                              aria-label="Mover después"
                              title="Mover después"
                              style={galleryMoveButtonStyle}
                            >
                              →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <input
                      ref={galleryFileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryImageAdd}
                      disabled={galleryUploading}
                    />
                    <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>Puedes elegir varias fotos a la vez.</p>
                    {galleryProgress && (
                      <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
                        Subiendo {galleryProgress.done} de {galleryProgress.total}…
                      </p>
                    )}
                    {galleryUploadError && <p style={{ fontSize: 12, color: "#c2185b", margin: "4px 0 0" }}>{galleryUploadError}</p>}
                  </div>
                </>
              )}

              {card(
                "contenido",
                5,
                "Contenido",
                values.useLandingBlocks ? (
                  <LandingBlocksEditor blocks={values.landingBlocks} onChange={(blocks) => set("landingBlocks", blocks)} />
                ) : (
                  <>
                    <div style={{ padding: "12px 14px", borderRadius: 8, background: "#fff8e6", border: "1px solid #f3e2b3", fontSize: 13 }}>
                      <strong>Modo clásico.</strong> Esta página todavía muestra una descripción de texto libre. Los bloques
                      (texto, fotos, galería, agenda, preguntas…) son la forma nueva de armar el contenido.
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <button
                          type="button"
                          onClick={moveDescriptionToBlocks}
                          style={{ padding: "7px 14px", borderRadius: 999, border: "none", background: "#12966b", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                        >
                          Pasar mi descripción a bloques
                        </button>
                        {values.landingBlocks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => set("useLandingBlocks", true)}
                            style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid #e3e1dc", background: "#fff", fontSize: 13, cursor: "pointer" }}
                          >
                            Usar los {values.landingBlocks.length} bloques que ya armé
                          </button>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: "#5b5f6b", margin: "8px 0 0" }}>
                        &quot;Pasar a bloques&quot; convierte la descripción en un bloque de Texto — no se pierde nada. El
                        público lo ve cuando guardes.
                      </p>
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Descripción</label>
                      <RichTextEditor value={values.description} onChange={(html) => set("description", html)} />
                    </div>
                  </>
                )
              )}

              {card(
                "cierre",
                6,
                "Frase de cierre",
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Título de la banda final (opcional)</label>
                  <input value={values.closingText} onChange={(e) => set("closingText", e.target.value)} placeholder="Nos vemos el 7 y 8 de noviembre en Cúcuta." />
                  <p style={{ fontSize: 12, color: "#5b5f6b", margin: "4px 0 0" }}>
                    La banda al final de la página, con el último botón de inscripción. Vacío = se arma sola con la fecha y la
                    ciudad del evento.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Publicación ──────────────────────────────────────────── */}
          <div role="tabpanel" style={{ display: tab === "publicacion" ? "block" : "none" }}>
            <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12 }}>
              <Section title="Estado">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <ChoiceButton active={!published} onClick={() => set("status", "DRAFT")} label="Borrador" hint="solo tú la ves" />
                  <ChoiceButton active={published} onClick={() => set("status", "PUBLISHED")} label="Publicado" hint="página activa" />
                </div>
                <p style={{ fontSize: 12, color: "#5b5f6b", margin: 0 }}>Se aplica al tocar &quot;Guardar cambios&quot;.</p>
              </Section>
              <Section title="Dirección de la página" last={!publicationActions}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>URL personalizada (opcional)</label>
                  <input value={values.slug} onChange={(e) => set("slug", e.target.value)} placeholder="cali-2026" style={{ maxWidth: 360 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <a href={fullUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: "var(--link)", wordBreak: "break-all" }}>
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
              </Section>
              {publicationActions && (
                <Section title="Acciones" last>
                  <div style={{ maxWidth: 280, border: "1px solid #f0efec", borderRadius: 8, padding: 4 }}>{publicationActions}</div>
                </Section>
              )}
            </div>
          </div>
        </form>

        {/* ── Entradas ─────────────────────────────────────────────── */}
        <div role="tabpanel" style={{ display: tab === "entradas" ? "block" : "none" }}>
          {ticketsSlot ?? (
            <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "24px 32px", fontSize: 14, color: "#5b5f6b" }}>
              Guarda el evento primero (botón &quot;Crear evento&quot; arriba) para agregar tipos de entrada.
            </div>
          )}
        </div>
    </div>
  );
}

// The one-line summary on a collapsed card: rich-text HTML → plain text.
function plainPreview(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// A big two-line option button (Formato, Estado) — easier to hit on a phone
// than a <select>, and all the options are visible at once.
function ChoiceButton({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        textAlign: "left",
        padding: "10px 16px",
        borderRadius: 10,
        border: `1.5px solid ${active ? "#12966b" : "#e3e1dc"}`,
        background: active ? "#e6f9f7" : "#fff",
        cursor: "pointer",
        color: "#1c1310",
        minWidth: 150,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#5b5f6b" }}>{hint}</div>
    </button>
  );
}

function removeButtonStyle(size: number): React.CSSProperties {
  return {
    position: "absolute",
    top: 4,
    right: 4,
    border: "none",
    borderRadius: 999,
    width: size,
    height: size,
    background: "rgba(28,19,16,0.7)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 13,
    lineHeight: 1,
  };
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

// Thumb-sized on purpose (the gallery gets managed from a phone) — the
// same ←/→ idea as LandingBlocksEditor's tinyButtonStyle, just not tiny.
const galleryMoveButtonStyle: React.CSSProperties = {
  flex: 1,
  height: 36,
  border: "1px solid #e3e1dc",
  borderRadius: 6,
  background: "#fff",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
};
