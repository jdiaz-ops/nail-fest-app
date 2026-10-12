"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewPageTexts } from "@/lib/reviewPageTexts";
import ReviewHero from "./ReviewHero";

const MAX_PHOTOS = 3;
const RATING_WORDS: Record<number, string> = { 1: "Muy malo", 2: "Malo", 3: "Regular", 4: "Muy bueno", 5: "Excelente" };

// The review form (see /resena/[token]/page.tsx for who gets here):
// the event's photo up top, then one white card with the four steps,
// the raffle box and the consent line. Photos upload as they are picked;
// the submit only carries their URLs. `texts` arrive with the
// placeholders already filled (page.tsx). `preview` (the team's
// ?vista=formulario): photos stay local and the submit just says so —
// nothing reaches the server. Styles: globals.css (.rv-*).
export default function ReviewForm({
  texts,
  brandName,
  displayClassName,
  eventImageUrl,
  token,
  raffle,
  preview = false,
}: {
  texts: ReviewPageTexts;
  brandName: string;
  displayClassName: string;
  eventImageUrl: string | null;
  token: string;
  raffle: { prizeCount: number; prizeLabel: string; closesLabel: string; open: boolean } | null;
  preview?: boolean;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [handle, setHandle] = useState("");
  const [publishConsent, setPublishConsent] = useState(false);
  const [raffleOptIn, setRaffleOptIn] = useState(Boolean(raffle?.open));
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const room = MAX_PHOTOS - photos.length;
    if (preview) {
      setPhotos((prev) => [...prev, ...Array.from(files).slice(0, room).map((file) => ({ url: URL.createObjectURL(file), name: file.name }))].slice(0, MAX_PHOTOS));
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setUploading(true);
    for (const file of Array.from(files).slice(0, room)) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/resenas/${encodeURIComponent(token)}/foto`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.url) {
        setError(body.error === "too_large" ? "Esa foto pesa más de 8 MB. Prueba con otra." : body.error === "not_an_image" ? "Solo se pueden subir fotos." : "No se pudo subir la foto. Intenta de nuevo.");
        continue;
      }
      setPhotos((prev) => (prev.length < MAX_PHOTOS ? [...prev, { url: body.url, name: file.name }] : prev));
    }
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function submit() {
    if (rating === 0) {
      setError("Elige cuántas estrellas le das al evento.");
      return;
    }
    if (preview) {
      setError("Vista previa: aquí no se envía nada. La asistente real pasaría ahora a la pantalla de gracias.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/resenas/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment, instagramHandle: handle, publishConsent, raffleOptIn: raffle?.open ? raffleOptIn : false, photoUrls: photos.map((p) => p.url) }),
    });
    setSubmitting(false);
    if (res.ok || res.status === 409) {
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(body.error === "bad_photo" ? "Una de las fotos no se pudo validar. Quítala y vuelve a subirla." : "No se pudo enviar la reseña. Intenta de nuevo.");
  }

  const shown = hover || rating;
  const check = (
    <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );

  return (
    <div className="rv-page">
      <ReviewHero brandName={brandName} eyebrow={texts.formEyebrow} imageUrl={eventImageUrl}>
        <span className="rv-seal">
          {check}
          <span>{texts.seal}</span>
        </span>
        <h1 className={`rv-title ${displayClassName}`}>{texts.formTitle}</h1>
        <p className="rv-intro">{texts.formIntro}</p>
      </ReviewHero>

      <div className="rv-body">
        <div className="rv-card">
          <div className="rv-field">
            <div className="rv-label">{texts.ratingLabel}</div>
            <div className="rv-stars" onMouseLeave={() => setHover(0)}>
              <div className="rv-stars-row">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className="rv-star" aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`} aria-pressed={rating === n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)}>
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                      <path fill={n <= shown ? "#f2b01e" : "none"} stroke={n <= shown ? "none" : "#d9c79a"} strokeWidth="1.6" d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" />
                    </svg>
                  </button>
                ))}
              </div>
              {shown > 0 && <span className="rv-stars-word">{RATING_WORDS[shown]}</span>}
            </div>
          </div>

          <label className="rv-field">
            <span className="rv-label">
              {texts.commentLabel} {texts.commentHint && <span className="rv-hint">{texts.commentHint}</span>}
            </span>
            <textarea className="rv-textarea" rows={4} maxLength={1500} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={texts.commentPlaceholder} />
          </label>

          <div className="rv-field">
            <div className="rv-label">
              {texts.photosLabel} {texts.photosHint && <span className="rv-hint">{texts.photosHint}</span>}
            </div>
            <div className="rv-tiles">
              {photos.map((p) => (
                <div key={p.url} className="rv-tile">
                  {/* eslint-disable-next-line @next/next/no-img-element -- just-uploaded Blob URL */}
                  <img src={p.url} alt="" />
                  <button type="button" className="rv-tile-remove" aria-label="Quitar foto" onClick={() => setPhotos((prev) => prev.filter((x) => x.url !== p.url))}>
                    ×
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" className="rv-tile-add" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h3l2-2h6l2 2h3v12H4z" />
                    <circle cx="12" cy="13" r="3.5" />
                  </svg>
                  <span>{uploading ? "Subiendo…" : "Agregar"}</span>
                </button>
              )}
            </div>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => pickPhotos(e.target.files)} />
          </div>

          <label className="rv-field">
            <span className="rv-label">
              {texts.instagramLabel} {texts.instagramHint && <span className="rv-hint">{texts.instagramHint}</span>}
            </span>
            <span className="rv-handle">
              <span className="rv-handle-at" aria-hidden="true">
                @
              </span>
              <input type="text" value={handle} onChange={(e) => setHandle(e.target.value.replace(/^@+/, ""))} placeholder="tu_usuario" maxLength={60} autoCapitalize="none" autoCorrect="off" />
            </span>
          </label>
        </div>

        {raffle?.open && (
          <div className="rv-raffle">
            <div className="rv-raffle-head">
              <span className="rv-raffle-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                </svg>
              </span>
              <span className="rv-eyebrow">{texts.raffleEyebrow}</span>
            </div>
            <div className="rv-raffle-text">{texts.raffleOptInText}</div>
            <label className="rv-check rv-check-strong">
              <input type="checkbox" checked={raffleOptIn} onChange={(e) => setRaffleOptIn(e.target.checked)} />
              <span>{texts.raffleOptInLabel}</span>
            </label>
          </div>
        )}

        <label className="rv-check rv-consent">
          <input type="checkbox" checked={publishConsent} onChange={(e) => setPublishConsent(e.target.checked)} />
          <span>{texts.consentText}</span>
        </label>

        {error && <p className="rv-error">{error}</p>}

        <button type="button" className="rv-cta" onClick={submit} disabled={submitting || uploading}>
          {submitting ? "Enviando…" : texts.submitLabel}
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        {texts.formFootnote && <p className="rv-foot">{texts.formFootnote}</p>}
      </div>
    </div>
  );
}
