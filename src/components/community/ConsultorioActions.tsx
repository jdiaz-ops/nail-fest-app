"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/imageCompression";
import { ANSWER_UP_TO, BODY_UP_TO, CONSULTORIO_TOPICS, TITLE_UP_TO } from "@/lib/community/consultorio";
import { send } from "@/components/portal/fields";

/** «Me sirvió · 12»: tap to say it helped (or take it back). Without an
 * account, it invites her to make one. */
export function UsefulButton({ answerId, count, voted, mine, signInHref }: { answerId: string; count: number; voted: boolean; mine: boolean; signInHref: string | null }) {
  const [state, setState] = useState({ count, voted, busy: false, message: null as string | null });
  if (signInHref) {
    return (
      <Link href={signInHref} className="cs-useful">
        Me sirvió · {count}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        className="cs-useful"
        aria-pressed={state.voted}
        disabled={mine || state.busy}
        title={mine ? "Es tu respuesta" : undefined}
        onClick={async () => {
          const on = !state.voted;
          setState((s) => ({ ...s, busy: true, voted: on, count: s.count + (on ? 1 : -1), message: null }));
          const result = await send(`/api/consultorio/respuestas/${answerId}/me-sirvio`, { on });
          if (result.ok && typeof result.data.usefulCount === "number") setState({ count: result.data.usefulCount, voted: on, busy: false, message: null });
          else setState({ count, voted, busy: false, message: result.message });
        }}
      >
        Me sirvió · {state.count}
      </button>
      {state.message && <span className="pt-bad">{state.message}</span>}
    </>
  );
}

/** «La que me resolvió»: whoever asked marks the answer that solved it. */
export function BestButton({ questionId, answerId, best }: { questionId: string; answerId: string; best: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`cs-mark${best ? " cs-mark--off" : ""}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await send(`/api/consultorio/preguntas/${questionId}/mejor`, { answerId: best ? null : answerId });
        setBusy(false);
        if (result.ok) router.refresh();
      }}
    >
      {best ? "Quitar «La que me resolvió»" : "Marcar: la que me resolvió"}
    </button>
  );
}

/** The box at the bottom of a question: "Respondes como …". */
export function AnswerComposer({ questionId, asLabel }: { questionId: string; asLabel: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [state, setState] = useState<{ sending: boolean; message: string | null }>({ sending: false, message: null });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (body.trim().length < 2) return;
    setState({ sending: true, message: null });
    const result = await send(`/api/consultorio/preguntas/${questionId}/respuestas`, { body });
    if (!result.ok) {
      setState({ sending: false, message: result.message });
      return;
    }
    setBody("");
    setState({ sending: false, message: null });
    router.refresh();
  }

  return (
    <form className="cs-composer" onSubmit={submit}>
      <div className="cs-composer-inner">
        <span className="cs-composer-as">Respondes como {asLabel}</span>
        {state.message && (
          <p className="pt-error" role="alert">
            {state.message}
          </p>
        )}
        <div className="cs-composer-row">
          <label htmlFor="cs-answer" className="bib-sr">
            Tu respuesta
          </label>
          <textarea id="cs-answer" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu respuesta…" maxLength={ANSWER_UP_TO} rows={1} required />
          <button type="submit" className="bib-btn bib-btn-main" disabled={state.sending || body.trim().length < 2}>
            {state.sending ? "Publicando…" : "Publicar"}
          </button>
        </div>
      </div>
    </form>
  );
}

/** "Haz tu pregunta": what it's about, the question, the details and a photo. */
export function AskForm({ asLabel, initialTopic }: { asLabel: string; initialTopic: string | null }) {
  const router = useRouter();
  const [topic, setTopic] = useState<string | null>(initialTopic);
  const [title, setTitle] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoState, setPhotoState] = useState<{ busy: boolean; message: string | null }>({ busy: false, message: null });
  const [state, setState] = useState<{ sending: boolean; message: string | null; fields: string[] }>({ sending: false, message: null, fields: [] });
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoState({ busy: true, message: null });
    try {
      const small = await compressImage(file, { maxDimension: 1400, quality: 0.82 }).catch(() => file);
      const form = new FormData();
      form.append("file", small);
      const res = await fetch("/api/consultorio/foto", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !data.url) setPhotoState({ busy: false, message: data.message ?? "No se pudo subir la foto." });
      else {
        setPhotoUrl(data.url);
        setPhotoState({ busy: false, message: null });
      }
    } catch {
      setPhotoState({ busy: false, message: "No hay conexión. Vuelve a intentarlo." });
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!topic) {
      setState({ sending: false, message: "Elige de qué trata tu pregunta.", fields: ["topic"] });
      return;
    }
    setState({ sending: true, message: null, fields: [] });
    const result = await send("/api/consultorio/preguntas", { topic, title, body: String(form.get("body") ?? ""), photoUrl });
    if (!result.ok) {
      setState({ sending: false, message: result.message, fields: result.fields });
      return;
    }
    router.push(`/consultorio/${String(result.data.slug)}`);
  }

  return (
    <form className="pt-card" onSubmit={submit}>
      <span className="pt-label-strong" id="ask-topic">
        ¿De qué trata?
      </span>
      <div className="pt-chips" role="group" aria-labelledby="ask-topic">
        {CONSULTORIO_TOPICS.map((t) => (
          <button key={t.key} type="button" className={`bib-chip${topic === t.key ? " is-on" : ""}`} aria-pressed={topic === t.key} onClick={() => setTopic(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor="ask-title">Tu pregunta</label>
        <input
          id="ask-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength={10}
          maxLength={TITLE_UP_TO}
          placeholder="¿Cómo hago para que el top coat no se ponga amarillo?"
          aria-invalid={state.fields.includes("title") || undefined}
        />
        <span className="pt-hint pt-count">
          {title.length} / {TITLE_UP_TO}
        </span>
      </div>
      <div className="field">
        <label htmlFor="ask-body">Detalles (opcional)</label>
        <textarea id="ask-body" name="body" rows={4} maxLength={BODY_UP_TO} placeholder="Qué producto usas, qué ya probaste, desde cuándo te pasa…" aria-invalid={state.fields.includes("body") || undefined} />
      </div>
      <div className="field">
        <span className="pt-label-strong">Foto (opcional)</span>
        {photoUrl ? (
          <div className="cs-photo">
            {/* eslint-disable-next-line @next/next/no-img-element -- the photo she just uploaded */}
            <img src={photoUrl} alt="La foto de tu pregunta" />
          </div>
        ) : null}
        <span className="pt-btns">
          <button type="button" className="bib-btn bib-btn-line bib-btn-sm" onClick={() => fileInput.current?.click()} disabled={photoState.busy}>
            {photoState.busy ? "Subiendo…" : photoUrl ? "Cambiar foto" : "Subir una foto"}
          </button>
          {photoUrl && (
            <button type="button" className="pt-link pt-link--muted" onClick={() => setPhotoUrl(null)}>
              Quitar
            </button>
          )}
        </span>
        {photoState.message && <span className="pt-bad">{photoState.message}</span>}
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
      </div>
      <span className="pt-hint">Preguntas como {asLabel}. Tu pregunta sale con tu nombre y tu ciudad.</span>
      {state.message && (
        <p className="pt-error" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="bib-btn bib-btn-main pt-wide" disabled={state.sending}>
        {state.sending ? "Publicando…" : "Publicar mi pregunta"}
      </button>
    </form>
  );
}
