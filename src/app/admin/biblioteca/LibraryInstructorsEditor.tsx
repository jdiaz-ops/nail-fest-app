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
  youtube: string;
  whatsapp: string;
  online: boolean;
  featured: boolean;
  invited: boolean;
  visible: boolean;
  appearances: string;
}

const EMPTY: Draft = {
  name: "",
  city: "",
  photoUrl: null,
  bio: "",
  specialties: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  whatsapp: "",
  online: false,
  featured: false,
  invited: true,
  visible: true,
  appearances: "",
};

function draftOf(i: AdminInstructor): Draft {
  return {
    name: i.name,
    city: i.city,
    photoUrl: i.photoUrl,
    bio: i.bio ?? "",
    specialties: i.specialties.join(", "),
    instagram: i.instagram ?? "",
    tiktok: i.tiktok ?? "",
    youtube: i.youtube ?? "",
    whatsapp: i.whatsapp ?? "",
    online: i.online,
    featured: i.featured,
    invited: i.invited,
    visible: i.visible,
    appearances: i.appearances.join("\n"),
  };
}

interface AccessLink {
  instructor: AdminInstructor;
  kind: "RESET" | "INVITE";
  url: string;
  text: string;
  whatsapp: string;
  phone: string | null;
}

const waOf = (phone: string) => `https://wa.me/${phone.replace(/\D/g, "")}`;
const smallButton = { ...secondaryButtonStyle, padding: "6px 10px", fontSize: 12 };

// Editar biblioteca → Instructoras: the directory's profiles. The ones made
// in the portal come in for review ("Para revisar") and only show once
// approved; the ones the team makes show as they're made. From here the
// team also makes the one-time links it sends by WhatsApp: a new password,
// or an invitation to look after a profile the team made. Her account's
// email and phone are never public.
export default function LibraryInstructorsEditor({ instructors }: { instructors: AdminInstructor[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<AccessLink | null>(null);
  const toReview = instructors.filter((i) => i.status === "review");
  const resets = instructors.filter((i) => i.account?.resetRequestedLabel);

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
    const account = instructor.account ? " y su cuenta del portal" : "";
    if (!confirm(`¿Eliminar a ${instructor.name}${account}? Sus videos se quedan en El Taller sin su nombre. Si solo quieres que no se vea, mejor apágala.`)) return;
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

  async function makeLink(instructor: AdminInstructor, kind: AccessLink["kind"]) {
    setBusyId(instructor.id);
    setError(null);
    try {
      const body = await api<{ url: string; text: string; whatsapp: string; phone: string | null }>(`/api/admin/library/instructors/${instructor.id}/enlace`, {
        method: "POST",
        body: JSON.stringify({ kind }),
      });
      setLink({ instructor, kind, ...body });
      router.refresh();
    } catch {
      setError("No se pudo crear el enlace. Vuelve a intentarlo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {toReview.length > 0 && (
        <div style={{ ...cardStyle, borderColor: "#f1dfae", background: "#fffbf0" }}>
          <CardTitle>Para revisar ({toReview.length})</CardTitle>
          <p style={{ ...mutedText, marginTop: 0 }}>
            Perfiles que hicieron en el portal y enviaron a revisión. «Aprobar» los publica en el directorio; «No publicar» los deja ocultos. A ella no le llega
            ningún mensaje: si quieres, escríbele por WhatsApp.
          </p>
          {error && <FormError>{error}</FormError>}
          {toReview.map((i) => (
            <div key={i.id} style={{ ...rowStyle, alignItems: "flex-start" }}>
              <BrandMark name={i.name} logoUrl={i.photoUrl} size={52} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{i.name}</div>
                <div style={{ ...mutedText, fontSize: 12 }}>
                  {[i.city + (i.online ? " · también en línea" : ""), i.specialties.join(", "), i.submittedAtLabel && `enviado el ${i.submittedAtLabel}`].filter(Boolean).join(" · ")}
                </div>
                {i.bio && <p style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.45 }}>{i.bio}</p>}
                <div style={{ ...mutedText, fontSize: 12, marginTop: 6 }}>
                  {[i.instagram && `Instagram @${i.instagram}`, i.tiktok && `TikTok @${i.tiktok}`, i.youtube && `YouTube ${i.youtube}`, i.whatsapp && `WhatsApp público ${i.whatsapp}`]
                    .filter(Boolean)
                    .join(" · ") || "Sin redes"}
                </div>
                {i.account && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Su cuenta: {i.account.email} ·{" "}
                    <a href={waOf(i.account.phone)} target="_blank" rel="noreferrer">
                      {i.account.phone}
                    </a>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button type="button" style={primaryButtonStyle} disabled={busyId === i.id} onClick={() => patch(i, { approved: true })}>
                    Aprobar
                  </button>
                  <button type="button" style={secondaryButtonStyle} disabled={busyId === i.id} onClick={() => patch(i, { visible: false })}>
                    No publicar
                  </button>
                  <a href={`/instructoras/${i.slug}`} target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle, textDecoration: "none" }}>
                    Ver perfil ↗
                  </a>
                  <button type="button" style={secondaryButtonStyle} onClick={() => setEditing({ id: i.id, draft: draftOf(i) })}>
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {resets.length > 0 && (
        <div style={{ ...cardStyle, borderColor: "#cfe0f5", background: "#f5f9ff" }}>
          <CardTitle>Pidieron cambiar su contraseña ({resets.length})</CardTitle>
          <p style={{ ...mutedText, marginTop: 0 }}>Desde «¿Olvidaste tu contraseña?». Crea su enlace y mándaselo por WhatsApp: sirve una vez, durante 7 días.</p>
          {resets.map((i) => (
            <div key={i.id} style={rowStyle}>
              <BrandMark name={i.name} logoUrl={i.photoUrl} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                <div style={{ ...mutedText, fontSize: 12 }}>
                  Usuario {i.slug} · lo pidió el {i.account!.resetRequestedLabel}
                </div>
              </div>
              <button type="button" style={primaryButtonStyle} disabled={busyId === i.id} onClick={() => makeLink(i, "RESET")}>
                Crear enlace
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={cardStyle}>
        <CardTitle
          aside={
            <button type="button" style={primaryButtonStyle} onClick={() => setEditing({ id: null, draft: EMPTY })}>
              Nueva instructora
            </button>
          }
        >
          Instructoras
        </CardTitle>
        <p style={{ ...mutedText, marginTop: 0 }}>
          Su perfil en nailfest.lat/instructoras, con sus videos. Las que se registran en el portal hacen su propio perfil y llegan a «Para revisar»; las que
          crea el equipo salen publicadas de una vez, y con «Invitar a manejar su perfil» lo pueden manejar ellas. Las destacadas salen primero.
        </p>
        {error && toReview.length === 0 && <FormError>{error}</FormError>}

        {instructors.length === 0 ? (
          <p style={{ ...mutedText, padding: "12px 0", borderTop: "1px solid #efece7", margin: 0 }}>
            Todavía no hay instructoras. Mientras tanto, el equipo ve ejemplos inventados en el directorio.
          </p>
        ) : (
          instructors.map((i) => (
            <div key={i.id} style={{ ...rowStyle, opacity: i.visible ? 1 : 0.6, flexWrap: "wrap" }}>
              <BrandMark name={i.name} logoUrl={i.photoUrl} size={44} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</div>
                <div style={{ ...mutedText, fontSize: 12 }}>
                  {[i.city, i.specialties.join(", "), i.videoCount === 1 ? "1 video" : `${i.videoCount} videos`].filter(Boolean).join(" · ")}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                  {i.status === "review" && <Pill tone="amber">Para revisar</Pill>}
                  {i.status === "draft" && <Pill tone="grey">Haciendo su perfil</Pill>}
                  {i.status === "paused" && <Pill tone="grey">Pausado por ella</Pill>}
                  {!i.visible && <Pill tone="red">Oculta</Pill>}
                  {i.featured && <Pill tone="amber">Destacada</Pill>}
                  {i.invited && <Pill tone="green">Invitada</Pill>}
                  {i.account && <Pill tone="grey">Con cuenta</Pill>}
                </div>
              </div>
              <a href={`/instructoras/${i.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }} title="Ver su perfil">
                Ver ↗
              </a>
              {i.account ? (
                <button type="button" style={smallButton} disabled={busyId === i.id} onClick={() => makeLink(i, "RESET")}>
                  Enlace para cambiar contraseña
                </button>
              ) : (
                <button type="button" style={smallButton} disabled={busyId === i.id} onClick={() => makeLink(i, "INVITE")}>
                  Invitar a manejar su perfil
                </button>
              )}
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
      </div>

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
      {link && <LinkSheet link={link} onClose={() => setLink(null)} />}
    </>
  );
}

/** The link just made: the message to copy, or WhatsApp opened with it written. */
function LinkSheet({ link, onClose }: { link: AccessLink; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title={link.kind === "RESET" ? `Enlace para ${link.instructor.name}` : `Invitación para ${link.instructor.name}`} onClose={onClose}>
      <p style={{ ...mutedText, marginTop: 0 }}>
        {link.kind === "RESET"
          ? "Con este enlace crea su contraseña nueva. Sirve una vez, durante 7 días; si haces otro, este deja de servir."
          : "Con este enlace crea su cuenta (correo, celular y contraseña) y maneja el perfil que hizo el equipo. Sirve una vez, durante 7 días."}{" "}
        No se le envía nada solo: mándaselo tú.
      </p>
      <div className="field">
        <label htmlFor="link-text">Mensaje</label>
        <textarea id="link-text" rows={4} readOnly value={link.text} onFocus={(e) => e.currentTarget.select()} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link.text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copiado" : "Copiar mensaje"}
        </button>
        <a href={link.whatsapp} target="_blank" rel="noreferrer" style={{ ...primaryButtonStyle, textDecoration: "none" }}>
          {link.phone ? `Abrir WhatsApp (${link.phone})` : "Abrir WhatsApp"}
        </a>
      </div>
    </Sheet>
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
      youtube: d.youtube || null,
      whatsapp: d.whatsapp || null,
      online: d.online,
      featured: d.featured,
      invited: d.invited,
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
      <Check checked={d.online} onChange={(v) => set("online", v)} label="También da clases en línea" />
      <div className="field">
        <label htmlFor="ins-bio">Descripción ({d.bio.length}/300)</label>
        <textarea id="ins-bio" rows={3} value={d.bio} maxLength={300} placeholder="En sus propias palabras: qué enseña y a quién." onChange={(e) => set("bio", e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ins-specialties">Especialidades (separadas por comas)</label>
        <input id="ins-specialties" value={d.specialties} placeholder="Polygel, Nail art, Semipermanente" onChange={(e) => set("specialties", e.target.value)} />
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
        <div className="field">
          <label htmlFor="ins-youtube">Canal de YouTube</label>
          <input id="ins-youtube" value={d.youtube} placeholder="youtube.com/@canal" onChange={(e) => set("youtube", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ins-whatsapp">WhatsApp para alumnas (se publica)</label>
          <input id="ins-whatsapp" value={d.whatsapp} placeholder="300 000 0000" onChange={(e) => set("whatsapp", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="ins-appearances">Eventos de Nail Fest en que ha estado (uno por línea)</label>
        <textarea id="ins-appearances" rows={3} value={d.appearances} placeholder="Nail Fest Cúcuta 2026 · Tarima principal" onChange={(e) => set("appearances", e.target.value)} />
      </div>
      <Check checked={d.featured} onChange={(v) => set("featured", v)} label="Destacada" hint="Sale primero en el directorio, con su sello." />
      <Check checked={d.invited} onChange={(v) => set("invited", v)} label="Sello «Instructora invitada Nail Fest»" hint="Para las instructoras que trajo el equipo." />
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
