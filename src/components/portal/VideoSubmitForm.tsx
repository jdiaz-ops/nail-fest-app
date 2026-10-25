"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SUBMISSION_TAGS_UP_TO } from "@/lib/library/portal";
import { LIBRARY_THEMES, VIDEO_TAG_SUGGESTIONS } from "@/lib/library/shared";
import { ChoiceChips, send } from "./fields";

// "Enviar un video" (Mis videos): her own YouTube link and its ficha, for
// the team to choose from. The first one carries the content permission.
export default function VideoSubmitForm({ needsContentTerms }: { needsContentTerms: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<{ sending: boolean; sent: boolean; message: string | null; fields: string[] }>({ sending: false, sent: false, message: null, fields: [] });
  const [tags, setTags] = useState<string[]>([]);
  const bad = (field: string) => state.fields.includes(field) || undefined;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const text = (key: string) => String(form.get(key) ?? "");
    setState({ sending: true, sent: false, message: null, fields: [] });
    const result = await send("/api/instructoras/videos", {
      youtube: text("youtube"),
      title: text("title"),
      theme: text("theme"),
      description: text("description"),
      products: text("products"),
      tags,
      acceptContent: form.get("acceptContent") === "on",
    });
    if (!result.ok) {
      setState({ sending: false, sent: false, message: result.message, fields: result.fields });
      return;
    }
    formEl.reset();
    setTags([]);
    setState({ sending: false, sent: true, message: null, fields: [] });
    router.refresh();
  }

  return (
    <form className="pt-card" id="enviar" onSubmit={submit}>
      <h2 className="pt-h3">Enviar un video</h2>
      <div className="field">
        <label htmlFor="vs-youtube">Enlace de YouTube</label>
        <input id="vs-youtube" name="youtube" required maxLength={300} inputMode="url" placeholder="youtube.com/shorts/…" autoCapitalize="none" spellCheck={false} aria-invalid={bad("youtube")} aria-describedby="vs-youtube-hint" />
        <span id="vs-youtube-hint" className="pt-hint">
          Súbelo a tu canal (público o no listado): las vistas son tuyas.
        </span>
      </div>
      <div className="field">
        <label htmlFor="vs-title">Título</label>
        <input id="vs-title" name="title" required minLength={3} maxLength={140} placeholder="Francesa invertida con cromo" aria-invalid={bad("title")} />
      </div>
      <div className="field">
        <label htmlFor="vs-theme">Tema</label>
        <select id="vs-theme" name="theme" required defaultValue="" aria-invalid={bad("theme")}>
          <option value="" disabled>
            Elige
          </option>
          {LIBRARY_THEMES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <span className="pt-label-strong" id="vs-tags">
          Etiquetas (hasta {SUBMISSION_TAGS_UP_TO}, opcional)
        </span>
        <ChoiceChips options={VIDEO_TAG_SUGGESTIONS} value={tags} onChange={setTags} max={SUBMISSION_TAGS_UP_TO} labelledBy="vs-tags" />
      </div>
      <div className="field">
        <label htmlFor="vs-description">Descripción</label>
        <textarea id="vs-description" name="description" maxLength={1000} rows={3} placeholder="Qué es, un consejo y para quién (2 o 3 líneas)" aria-invalid={bad("description")} />
      </div>
      <div className="field">
        <label htmlFor="vs-products">Lo que usaste (uno por línea)</label>
        <textarea id="vs-products" name="products" maxLength={3000} rows={3} placeholder="Marca · producto · tono o medida" />
      </div>
      {needsContentTerms && (
        <label className="bib-check">
          <input type="checkbox" name="acceptContent" required />
          <span>
            El video es mío y acepto el{" "}
            <Link href="/instructoras/terminos#contenido" target="_blank">
              permiso de uso de contenido
            </Link>
            . Solo te lo pedimos con el primer video.
          </span>
        </label>
      )}
      <span className="pt-hint">Vertical, editado, de 30 a 60 segundos, con subtítulos y sin música con derechos de autor.</span>
      {state.message && (
        <p className="pt-error" role="alert">
          {state.message}
        </p>
      )}
      {state.sent && (
        <p className="pt-saved" role="status">
          ¡Enviado! Quedó en revisión: el equipo decide si sale en la biblioteca.
        </p>
      )}
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={state.sending}>
        {state.sending ? "Enviando…" : "Enviar video"}
      </button>
    </form>
  );
}
