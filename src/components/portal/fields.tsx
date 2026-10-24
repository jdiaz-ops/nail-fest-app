"use client";

import { useRef, useState } from "react";
import type { Instructor } from "@prisma/client";
import { compressImage } from "@/lib/imageCompression";
import { INSTRUCTOR_SPECIALTIES, SPECIALTIES_UP_TO } from "@/lib/library/portal";
import { PortalFace } from "./PortalShell";
import { PortalIcon } from "./icons";

// What the portal's forms share: the call to /api/instructoras/*, the
// password box, the specialties, the city and the photo.

export interface SendResult {
  ok: boolean;
  /** Already in words, from the route — or about the connection. */
  message: string | null;
  fields: string[];
  data: Record<string, unknown>;
}

export async function send(url: string, body?: unknown, method = "POST"): Promise<SendResult> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) return { ok: true, message: null, fields: [], data };
    return {
      ok: false,
      message: typeof data.message === "string" ? data.message : "No se pudo guardar. Vuelve a intentarlo en un momento.",
      fields: Array.isArray(data.fields) ? data.fields.map(String) : [],
      data,
    };
  } catch {
    return { ok: false, message: "No hay conexión. Vuelve a intentarlo en un momento.", fields: [], data: {} };
  }
}

/** A password box with «Mostrar». */
export function PasswordInput({
  id,
  name = "password",
  autoComplete,
  minLength,
  invalid,
  describedBy,
}: {
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pt-inputbox">
      <input
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        required
        minLength={minLength}
        maxLength={200}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
      <button type="button" className="pt-link pt-show" onClick={() => setShown((s) => !s)} aria-pressed={shown}>
        {shown ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  );
}

/** The list's specialties — plus any the team had given her — up to 5. */
export function SpecialtyChips({ value, onChange, labelledBy }: { value: string[]; onChange: (next: string[]) => void; labelledBy: string }) {
  return <ChoiceChips options={INSTRUCTOR_SPECIALTIES} value={value} onChange={onChange} max={SPECIALTIES_UP_TO} labelledBy={labelledBy} />;
}

/** Chips to pick some of a list, up to a number — the ones already picked
 * that aren't in the list stay first. */
export function ChoiceChips({
  options: list,
  value,
  onChange,
  max,
  labelledBy,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  max: number;
  labelledBy: string;
}) {
  const options = [...value.filter((s) => !list.includes(s)), ...list];
  const full = value.length >= max;
  return (
    <div className="pt-chips" role="group" aria-labelledby={labelledBy}>
      {options.map((s) => {
        const on = value.includes(s);
        return (
          <button
            key={s}
            type="button"
            className={`bib-chip${on ? " is-on" : ""}`}
            aria-pressed={on}
            disabled={!on && full}
            onClick={() => onChange(on ? value.filter((v) => v !== s) : [...value, s])}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

const CITIES = [
  "Bogotá",
  "Medellín",
  "Cali",
  "Barranquilla",
  "Cartagena",
  "Cúcuta",
  "Bucaramanga",
  "Pereira",
  "Manizales",
  "Ibagué",
  "Santa Marta",
  "Villavicencio",
  "Pasto",
  "Montería",
  "Neiva",
  "Armenia",
  "Valledupar",
  "Popayán",
  "Sincelejo",
  "Tunja",
];

/** Her city, typed — with the usual ones suggested. */
export function CityInput({ id, value, onChange, invalid }: { id: string; value: string; onChange: (city: string) => void; invalid?: boolean }) {
  return (
    <>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={`${id}-list`}
        required
        minLength={2}
        maxLength={60}
        autoComplete="address-level2"
        aria-invalid={invalid || undefined}
      />
      <datalist id={`${id}-list`}>
        {CITIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}

/** Her photo: made smaller on the phone first, then into her own folder. */
export function PhotoPicker({
  instructor,
  photoUrl,
  onChange,
}: {
  instructor: Pick<Instructor, "name" | "slug">;
  photoUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  async function pick(file: File | undefined) {
    if (!file) return;
    setState({ busy: true, error: null });
    try {
      const small = file.type.startsWith("image/") ? await compressImage(file, { maxDimension: 900, quality: 0.85 }).catch(() => file) : file;
      const form = new FormData();
      form.append("file", small);
      const res = await fetch("/api/instructoras/foto", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !data.url) {
        setState({ busy: false, error: data.message ?? "No se pudo subir la foto. Vuelve a intentarlo." });
        return;
      }
      onChange(data.url);
      setState({ busy: false, error: null });
    } catch {
      setState({ busy: false, error: "No hay conexión. Vuelve a intentarlo en un momento." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="pt-photo">
      <PortalFace instructor={{ ...instructor, photoUrl }} big />
      <span className="pt-photo-text">
        <b>Tu foto</b>
        <span className="pt-btns">
          <button type="button" className="bib-btn bib-btn-line bib-btn-sm" onClick={() => input.current?.click()} disabled={state.busy}>
            <PortalIcon name="camera" size={16} />
            {state.busy ? "Subiendo…" : photoUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {photoUrl && !state.busy && (
            <button type="button" className="pt-link pt-link--muted" onClick={() => onChange(null)}>
              Quitar
            </button>
          )}
        </span>
        {state.error ? <span className="pt-bad">{state.error}</span> : <span className="pt-hint">Una foto tuya, de frente y con buena luz.</span>}
      </span>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

export interface SocialValues {
  instagram: string;
  tiktok: string;
  youtube: string;
  whatsapp: string;
}

/** Her networks, and a WhatsApp for students if she wants one on her profile. */
export function SocialFields({
  idPrefix,
  value,
  onChange,
  invalid,
}: {
  idPrefix: string;
  value: SocialValues;
  onChange: (key: keyof SocialValues, next: string) => void;
  invalid: string[];
}) {
  const box = (key: keyof SocialValues, label: string, placeholder: string, hint?: string) => (
    <div className="field">
      <label htmlFor={`${idPrefix}-${key}`}>{label}</label>
      <input
        id={`${idPrefix}-${key}`}
        value={value[key]}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={placeholder}
        maxLength={200}
        type={key === "whatsapp" ? "tel" : "text"}
        inputMode={key === "whatsapp" ? "tel" : undefined}
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={invalid.includes(key) || undefined}
      />
      {hint && <span className="pt-hint">{hint}</span>}
    </div>
  );
  return (
    <>
      {box("instagram", "Instagram", "@tu.usuario")}
      {box("tiktok", "TikTok", "@tu.usuario")}
      {box("youtube", "Canal de YouTube", "youtube.com/@tucanal")}
      {box("whatsapp", "WhatsApp para alumnas (opcional, se publica)", "300 000 0000", "Sale en tu perfil con un botón para escribirte. Déjalo vacío si no lo quieres ahí.")}
    </>
  );
}
