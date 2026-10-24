"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BIO_UP_TO, type PortalProfileValues } from "@/lib/library/portal";
import { CityInput, PhotoPicker, SocialFields, SpecialtyChips, send } from "./fields";

// "Mi perfil" in the portal: everything that's hers to change, saved in
// one go, and her own switch to pause it once the team has approved it.
// What the team decides (the seal, "Destacada", "Ha estado en") only shows.
export default function ProfileEditor({
  slug,
  initial,
  approved,
  initialPaused,
  directoryOpen,
  teamMarks,
}: {
  slug: string;
  initial: PortalProfileValues;
  /** Only an approved profile can be paused and shown again. */
  approved: boolean;
  initialPaused: boolean;
  /** The directory is open to the public. */
  directoryOpen: boolean;
  /** "Lo pone Nail Fest": what the team gave her. */
  teamMarks: string[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [paused, setPaused] = useState(initialPaused);
  const [state, setState] = useState<{ saving: boolean; saved: boolean; message: string | null; fields: string[] }>({ saving: false, saved: false, message: null, fields: [] });
  const set = <K extends keyof PortalProfileValues>(key: K, value: PortalProfileValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setState((s) => ({ ...s, saved: false }));
  };
  const bad = (field: string) => state.fields.includes(field) || undefined;

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (v.name.trim().length < 2) {
      setState({ saving: false, saved: false, message: "Escribe tu nombre (al menos 2 letras).", fields: ["name"] });
      return;
    }
    setState({ saving: true, saved: false, message: null, fields: [] });
    const result = await send("/api/instructoras/perfil", { ...v, ...(approved ? { paused } : {}) }, "PATCH");
    if (!result.ok) {
      setState({ saving: false, saved: false, message: result.message, fields: result.fields });
      return;
    }
    setState({ saving: false, saved: true, message: null, fields: [] });
    router.refresh();
  }

  return (
    <form className="pt-form" onSubmit={save}>
      <div className="pt-card">
        <PhotoPicker instructor={{ name: v.name || slug, slug }} photoUrl={v.photoUrl} onChange={(url) => set("photoUrl", url)} />
      </div>

      <div className="pt-card">
        <div className="field">
          <label htmlFor="pf-name">Nombre como quieres aparecer</label>
          <input id="pf-name" value={v.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={80} autoComplete="name" aria-invalid={bad("name")} />
        </div>
        <div className="field">
          <label htmlFor="pf-city">Ciudad</label>
          <CityInput id="pf-city" value={v.city} onChange={(city) => set("city", city)} invalid={bad("city")} />
        </div>
        <label className="bib-check">
          <input type="checkbox" checked={v.online} onChange={(e) => set("online", e.target.checked)} />
          <span>También doy clases en línea</span>
        </label>
        <div className="field">
          <span className="pt-label-strong" id="pf-specialties">
            Especialidades (hasta 5)
          </span>
          <SpecialtyChips value={v.specialties} onChange={(s) => set("specialties", s)} labelledBy="pf-specialties" />
        </div>
        <div className="field">
          <label htmlFor="pf-bio">Sobre ti</label>
          <textarea id="pf-bio" value={v.bio} onChange={(e) => set("bio", e.target.value)} maxLength={BIO_UP_TO} rows={5} aria-invalid={bad("bio")} />
          <span className="pt-hint pt-count">
            {v.bio.length} / {BIO_UP_TO}
          </span>
        </div>
      </div>

      <div className="pt-card" id="redes">
        <h2 className="pt-h3">Redes y contacto</h2>
        <SocialFields idPrefix="pf" value={v} onChange={(key, value) => set(key, value)} invalid={state.fields} />
      </div>

      {approved && (
        <div className="pt-card">
          <div className="pt-switchrow">
            <span>
              <b id="pf-show">Mostrar mi perfil en el directorio</b>
              <br />
              <span className="pt-hint">Apágalo para pausarlo sin borrar nada.</span>
            </span>
            <button
              type="button"
              className="pt-switch"
              role="switch"
              aria-checked={!paused}
              aria-labelledby="pf-show"
              onClick={() => {
                setPaused((p) => !p);
                setState((s) => ({ ...s, saved: false }));
              }}
            />
          </div>
        </div>
      )}

      <div className="pt-card pt-card--soft">
        <h2 className="pt-h3">Lo pone Nail Fest</h2>
        {teamMarks.length > 0 && (
          <div className="pt-locked">
            {teamMarks.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        )}
        <span className="pt-hint">El sello de invitada, las destacadas y los eventos de Nail Fest en los que has estado los marca el equipo.</span>
      </div>

      {state.message && (
        <p className="pt-error" role="alert">
          {state.message}
        </p>
      )}
      {state.saved && (
        <p className="pt-saved" role="status">
          Guardado.{directoryOpen && approved && !paused ? " Ya se ve así en el directorio." : ""}
        </p>
      )}
      <div className="pt-actions">
        <Link href={`/instructoras/${slug}`} className="bib-btn bib-btn-line">
          Ver mi perfil
        </Link>
        <button type="submit" className="bib-btn bib-btn-main" disabled={state.saving}>
          {state.saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
