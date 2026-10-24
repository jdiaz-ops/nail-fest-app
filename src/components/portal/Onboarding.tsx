"use client";

import { useState } from "react";
import Link from "next/link";
import { BIO_UP_TO, ONBOARDING_STEPS, type PortalProfileValues } from "@/lib/library/portal";
import { PortalFace } from "./PortalShell";
import { CityInput, PhotoPicker, SocialFields, SpecialtyChips, send } from "./fields";
import { PortalIcon } from "./icons";

type Problem = { message: string; fields: string[] } | null;

// The onboarding (/instructoras/portal/bienvenida): her profile in five
// short steps, each saved as she goes, and the last one sends it to the
// team — who approve it before it shows in the directory.
export default function Onboarding({ slug, initial, titleClass }: { slug: string; initial: PortalProfileValues; titleClass: string }) {
  const [step, setStep] = useState(0);
  const [v, setV] = useState(initial);
  const [problem, setProblem] = useState<Problem>(null);
  const [saving, setSaving] = useState(false);
  const total = ONBOARDING_STEPS.length;
  const last = step === total - 1;
  const set = <K extends keyof PortalProfileValues>(key: K, value: PortalProfileValues[K]) => setV((prev) => ({ ...prev, [key]: value }));
  const bad = (field: string) => Boolean(problem?.fields.includes(field)) || undefined;

  /** What this step saves — or why it can't go on yet. */
  function stepData(): Record<string, unknown> | string {
    if (step === 0) return v.name.trim().length < 2 ? "Escribe tu nombre (al menos 2 letras)." : { name: v.name, photoUrl: v.photoUrl };
    if (step === 1) {
      if (v.city.trim().length < 2) return "Escribe tu ciudad.";
      if (!v.specialties.length) return "Elige al menos una especialidad.";
      return { city: v.city, online: v.online, specialties: v.specialties };
    }
    if (step === 2) return { bio: v.bio };
    if (step === 3) return { instagram: v.instagram, tiktok: v.tiktok, youtube: v.youtube, whatsapp: v.whatsapp };
    return {};
  }

  function go(to: number) {
    setProblem(null);
    setStep(to);
    window.scrollTo({ top: 0 });
  }

  async function next() {
    const data = stepData();
    if (typeof data === "string") {
      setProblem({ message: data, fields: [] });
      return;
    }
    setSaving(true);
    setProblem(null);
    const result = last ? await send("/api/instructoras/perfil/enviar") : await send("/api/instructoras/perfil", data, "PATCH");
    if (result.ok && last) {
      window.location.assign("/instructoras/portal");
      return;
    }
    setSaving(false);
    if (!result.ok) {
      setProblem({ message: result.message ?? "Revisa los datos.", fields: result.fields });
      return;
    }
    go(step + 1);
  }

  const networks = [v.instagram && `Instagram ${v.instagram}`, v.tiktok && `TikTok ${v.tiktok}`, v.youtube && "YouTube", v.whatsapp && "WhatsApp"].filter(Boolean).join(" · ");
  const summaries = [
    `${v.name || "Sin nombre"}${v.photoUrl ? " · con foto" : " · sin foto"}`,
    [v.city, v.specialties.join(", ")].filter(Boolean).join(" · ") || "Sin completar",
    v.bio ? (v.bio.length > 70 ? `${v.bio.slice(0, 70)}…` : v.bio) : "Sin escribir (opcional)",
    networks || "Sin redes (opcional)",
  ];

  return (
    <div className="pt-wrap">
      <div className="pt-progress">
        <div className="pt-progress-top">
          <span>
            Paso {step + 1} de {total}
          </span>
          <span>{ONBOARDING_STEPS[step]}</span>
        </div>
        <div className="pt-meter" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1} aria-label="Tu avance">
          <span style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
        <ol className="pt-dots">
          {ONBOARDING_STEPS.map((label, i) => (
            <li key={label} className={i < step ? "is-done" : i === step ? "is-now" : undefined}>
              {i < step ? "✓ " : ""}
              {label}
            </li>
          ))}
        </ol>
      </div>

      {step === 0 && (
        <>
          <h1 className={`pt-h1 ${titleClass}`}>¿Cómo quieres aparecer?</h1>
          <div className="pt-card">
            <PhotoPicker instructor={{ name: v.name || slug, slug }} photoUrl={v.photoUrl} onChange={(url) => set("photoUrl", url)} />
            <div className="field">
              <label htmlFor="ob-name">Tu nombre</label>
              <input
                id="ob-name"
                value={v.name}
                onChange={(e) => set("name", e.target.value)}
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                aria-invalid={bad("name")}
                aria-describedby="ob-name-hint"
              />
              <span id="ob-name-hint" className="pt-hint">
                Como te conocen tus alumnas: tu nombre o tu nombre artístico.
              </span>
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h1 className={`pt-h1 ${titleClass}`}>¿Dónde das clases y qué enseñas?</h1>
          <div className="pt-card">
            <div className="field">
              <label htmlFor="ob-city">Ciudad</label>
              <CityInput id="ob-city" value={v.city} onChange={(city) => set("city", city)} invalid={bad("city")} />
            </div>
            <label className="bib-check">
              <input type="checkbox" checked={v.online} onChange={(e) => set("online", e.target.checked)} />
              <span>También doy clases en línea</span>
            </label>
          </div>
          <div className="pt-card">
            <span className="pt-label-strong" id="ob-specialties">
              Especialidades (hasta 5)
            </span>
            <SpecialtyChips value={v.specialties} onChange={(s) => set("specialties", s)} labelledBy="ob-specialties" />
            <span className="pt-hint">Son las que usa el buscador del directorio.</span>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h1 className={`pt-h1 ${titleClass}`}>Cuéntales sobre ti</h1>
          <div className="pt-card">
            <div className="field">
              <label htmlFor="ob-bio">Sobre ti (opcional)</label>
              <textarea id="ob-bio" value={v.bio} onChange={(e) => set("bio", e.target.value)} maxLength={BIO_UP_TO} rows={5} aria-invalid={bad("bio")} aria-describedby="ob-bio-hint" />
              <span className="pt-hint pt-count" aria-live="polite">
                {v.bio.length} / {BIO_UP_TO}
              </span>
            </div>
            <span id="ob-bio-hint" className="pt-hint">
              Qué enseñas, desde cuándo y para quién. Por ejemplo: «Educadora de uñas desde 2018. Enseño polygel y nail art a manicuristas que empiezan».
            </span>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className={`pt-h1 ${titleClass}`}>¿Dónde te encuentran?</h1>
          <div className="pt-card">
            <SocialFields idPrefix="ob" value={v} onChange={(key, value) => set(key, value)} invalid={problem?.fields ?? []} />
          </div>
        </>
      )}

      {last && (
        <>
          <h1 className={`pt-h1 ${titleClass}`}>Revisa y envía</h1>
          <div className="pt-card pt-review">
            <div className="pt-review-head">
              <PortalFace instructor={{ name: v.name || slug, slug, photoUrl: v.photoUrl }} big />
              <span>
                <b className={titleClass}>{v.name}</b>
                <small>
                  {v.city}
                  {v.online ? " · también en línea" : ""}
                </small>
              </span>
            </div>
            {v.specialties.length > 0 && (
              <div className="pt-locked">
                {v.specialties.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            )}
            {v.bio && <p>{v.bio}</p>}
            <Link href={`/instructoras/${slug}`} target="_blank" className="pt-link">
              Ver cómo queda mi perfil
            </Link>
          </div>
          <div className="pt-menu">
            {ONBOARDING_STEPS.slice(0, -1).map((label, i) => (
              <button key={label} type="button" className="pt-item" onClick={() => go(i)}>
                <span className="pt-ic bib-tone-mint">
                  <PortalIcon name="check" />
                </span>
                <span>
                  <b>{label}</b>
                  <small>{summaries[i]}</small>
                </span>
                <span className="pt-change">Cambiar</span>
              </button>
            ))}
          </div>
          <p className="pt-center">El equipo de Nail Fest lo revisa antes de publicarlo. Mientras tanto, lo puedes seguir cambiando.</p>
        </>
      )}

      {problem && (
        <p className="pt-error" role="alert">
          {problem.message}
        </p>
      )}
      <div className="pt-actions">
        {step > 0 && (
          <button type="button" className="bib-btn bib-btn-line" onClick={() => go(step - 1)} disabled={saving}>
            Atrás
          </button>
        )}
        <button type="button" className="bib-btn bib-btn-main" onClick={next} disabled={saving}>
          {saving ? "Guardando…" : last ? "Enviar a revisión" : "Siguiente"}
        </button>
      </div>
      {!last && <p className="pt-center">Lo puedes cambiar después desde tu portal.</p>}
    </div>
  );
}
