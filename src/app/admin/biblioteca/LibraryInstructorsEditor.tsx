"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AdminInstructor } from "@/lib/library/admin";
import { api, BrandMark, CardTitle, cardStyle, IconButton, mutedText, Pill, primaryButtonStyle, secondaryButtonStyle, Switch } from "../cuponera/ui";
import { Check, FormError, Sheet, linesOf, listOf, rowStyle, twoColumns } from "./ui";

interface Draft {
  name: string;
  city: string;
  photoUrl: string | null;
  bio: string;
  specialties: string;
  instagram: string;
  tiktok: string;
  featured: boolean;
  visible: boolean;
  appearances: string;
}

const EMPTY: Draft = { name: "", city: "", photoUrl: null, bio: "", specialties: "", instagram: "", tiktok: "", featured: false, visible: true, appearances: "" };

function draftOf(i: AdminInstructor): Draft {
  return {
    name: i.name,
    city: i.city,
    photoUrl: i.photoUrl,
    bio: i.bio ?? "",
    specialties: i.specialties.join(", "),
    instagram: i.instagram ?? "",
    tiktok: i.tiktok ?? "",
    featured: i.featured,
    visible: i.visible,
    appearances: i.appearances.join("\n"),
  };
}

// Editar biblioteca → Instructoras: the Instructoras Nail Fest and their
// public profiles — only what the agreement says is public (never her
// document, phone or email; those stay in her registration).
export default function LibraryInstructorsEditor({ instructors }: { instructors: AdminInstructor[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(instructor: AdminInstructor, body: Record<string, unknown>) {
    setBusyId(instructor.id);
    setError(null);
    try {
      await api(`/api/admin/library/instructors/${instructor.id}`, { method: "PATCH", body: JSON.stringify(body) });
      router.refresh();
    } catch {
      setError("No se pudo cambiar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(instructor: AdminInstructor) {
    if (!confirm(`¿Eliminar a ${instructor.name}? Sus videos se quedan en la biblioteca sin su nombre y sus clases se borran. Si solo quieres que no se vea, mejor apágala.`)) return;
    setBusyId(instructor.id);
    setError(null);
    try {
      await api(`/api/admin/library/instructors/${instructor.id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setError("No se pudo eliminar. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={cardStyle}>
      <CardTitle
        aside={
          <button type="button" style={primaryButtonStyle} onClick={() => setEditing({ id: null, draft: EMPTY })}>
            Nueva instructora
          </button>
        }
      >
        Instructoras Nail Fest
      </CardTitle>
      <p style={{ ...mutedText, marginTop: 0 }}>
        Su perfil en nailfest.lat/instructoras, con sus videos y sus clases. Las destacadas salen primero y con su sello. Solo lo que ella autorizó
        en el acuerdo: nunca su documento, teléfono ni correo.
      </p>
      {error && <FormError>{error}</FormError>}

      {instructors.length === 0 ? (
        <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>
          Todavía no hay instructoras. Mientras tanto, el equipo ve ejemplos inventados en el directorio.
        </p>
      ) : (
        instructors.map((i) => (
          <div key={i.id} style={{ ...rowStyle, opacity: i.visible ? 1 : 0.6 }}>
            <BrandMark name={i.name} logoUrl={i.photoUrl} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
              <div style={{ ...mutedText, fontSize: 12 }}>
                {[i.city, i.specialties.join(", "), i.videoCount === 1 ? "1 video" : `${i.videoCount} videos`].filter(Boolean).join(" · ")}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                {i.featured && <Pill tone="amber">Destacada</Pill>}
                {!i.visible && <Pill tone="red">Oculta</Pill>}
              </div>
            </div>
            <a href={`/instructoras/${i.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }} title="Ver su perfil">
              Ver ↗
            </a>
            <Switch checked={i.visible} disabled={busyId === i.id} label={i.visible ? "Visible" : "Oculta"} onChange={(next) => patch(i, { visible: next })} />
            <IconButton title="Editar" onClick={() => setEditing({ id: i.id, draft: draftOf(i) })}>
              ✏️
            </IconButton>
            <IconButton title="Eliminar" disabled={busyId === i.id} onClick={() => remove(i)}>
              🗑️
            </IconButton>
          </div>
        ))
      )}

      {editing && (
        <InstructorForm
          id={editing.id}
          initial={editing.draft}
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

function InstructorForm({ id, initial, onClose, onSaved }: { id: string | null; initial: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/uploads/library-image", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body?.url !== "string") {
        setMessage(
          body?.error === "too_large"
            ? "La foto pesa más de 5 MB."
            : body?.error === "blob_not_configured"
              ? "El almacenamiento de imágenes no está configurado."
              : "No se pudo subir la foto.",
        );
      } else {
        set("photoUrl", body.url);
      }
    } catch {
      setMessage("No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (d.name.trim().length < 2 || d.city.trim().length < 2) return setMessage("Falta el nombre o la ciudad.");
    setSaving(true);
    setMessage(null);
    const body = {
      name: d.name,
      city: d.city,
      photoUrl: d.photoUrl,
      bio: d.bio || null,
      specialties: listOf(d.specialties),
      instagram: d.instagram || null,
      tiktok: d.tiktok || null,
      featured: d.featured,
      visible: d.visible,
      appearances: linesOf(d.appearances),
    };
    try {
      await api(id ? `/api/admin/library/instructors/${id}` : "/api/admin/library/instructors", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error && e.message === "invalid_body" ? "Revisa los datos: la descripción va hasta 300 letras y hasta 8 especialidades." : "No se pudo guardar. Vuelve a intentarlo.");
      setSaving(false);
    }
  }

  return (
    <Sheet title={id ? "Editar instructora" : "Nueva instructora"} onClose={onClose}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <BrandMark name={d.name || "?"} logoUrl={d.photoUrl} size={72} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label style={{ ...secondaryButtonStyle, display: "inline-block" }}>
            {uploading ? "Subiendo…" : d.photoUrl ? "Cambiar foto" : "Subir foto"}
            <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
          {d.photoUrl && (
            <button type="button" style={secondaryButtonStyle} onClick={() => set("photoUrl", null)}>
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <div style={twoColumns}>
        <div className="field">
          <label htmlFor="ins-name">Nombre con el que quiere aparecer</label>
          <input id="ins-name" value={d.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ins-city">Ciudad</label>
          <input id="ins-city" value={d.city} maxLength={60} onChange={(e) => set("city", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ins-bio">Descripción ({d.bio.length}/300)</label>
        <textarea id="ins-bio" rows={3} value={d.bio} maxLength={300} placeholder="En sus propias palabras: qué enseña y a quién." onChange={(e) => set("bio", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ins-specialties">Especialidades (separadas por comas)</label>
        <input id="ins-specialties" value={d.specialties} placeholder="Polygel, Nail art, Francesa" onChange={(e) => set("specialties", e.target.value)} />
      </div>
      <div style={twoColumns}>
        <div className="field">
          <label htmlFor="ins-instagram">Instagram</label>
          <input id="ins-instagram" value={d.instagram} placeholder="@usuario o el link" onChange={(e) => set("instagram", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ins-tiktok">TikTok</label>
          <input id="ins-tiktok" value={d.tiktok} placeholder="@usuario o el link" onChange={(e) => set("tiktok", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ins-appearances">Eventos de Nail Fest en que ha estado (uno por línea)</label>
        <textarea id="ins-appearances" rows={3} value={d.appearances} placeholder="Nail Fest Cúcuta 2026 · Tarima principal" onChange={(e) => set("appearances", e.target.value)} />
      </div>
      <Check checked={d.featured} onChange={(v) => set("featured", v)} label="Destacada" hint="Nivel 3 del acuerdo: sale primero en el directorio, con su sello." />
      <Check checked={d.visible} onChange={(v) => set("visible", v)} label="Perfil visible" />
      {message && <FormError>{message}</FormError>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" style={secondaryButtonStyle} onClick={onClose}>
          Cancelar
        </button>
        <button type="button" style={primaryButtonStyle} disabled={saving || uploading} onClick={save}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </Sheet>
  );
}
