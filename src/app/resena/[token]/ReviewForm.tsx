"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewPageTexts } from "@/lib/reviewPageTexts";
import ReviewPageHeader from "./ReviewPageHeader";

const MAX_PHOTOS = 3;
const RATING_WORDS: Record<number, string> = { 1: "Muy malo", 2: "Malo", 3: "Regular", 4: "Muy bueno", 5: "Excelente" };

// The review form (see /resena/[token]/page.tsx for who gets here).
// Photos upload as they are picked; the submit only carries their URLs.
// `texts` arrive with the placeholders already filled (page.tsx).
// `preview` (the team's ?vista=formulario): photos stay local and the
// submit just says so — nothing reaches the server.
export default function ReviewForm({
  texts,
  brandName,
  displayClassName,
  token,
  eventName,
  raffle,
  preview = false,
}: {
  texts: ReviewPageTexts;
  brandName: string;
  displayClassName: string;
  token: string;
  firstName: string;
  eventName: string;
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
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "18px 20px 48px", display: "flex", flexDirection: "column", gap: 18 }}>
      <ReviewPageHeader brandName={brandName} eyebrow={texts.formEyebrow} displayClassName={displayClassName} />
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#e6f9f7", color: "#0b2e2c", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 700, alignSelf: "flex-start" }}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0b2e2c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        <span>Asistió a {eventName}</span>
      </div>
      <h1 className={displayClassName} style={{ margin: 0, fontSize: 28, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.02em" }}>
        {texts.formTitle}
      </h1>
      <p style={{ margin: 0, fontSize: 14, color: "#5b5f6b", lineHeight: 1.45 }}>{texts.formIntro}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{texts.ratingLabel}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }} onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              style={{ width: 48, height: 48, border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
            >
              <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24">
                <path fill={n <= shown ? "#f2b01e" : "none"} stroke={n <= shown ? "none" : "#c9b58a"} strokeWidth="1.6" d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.3 6.7L12 17.5l-6 3.3 1.3-6.7-5-4.6 6.8-.8z" />
              </svg>
            </button>
          ))}
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0b2e2c", marginLeft: 6, minWidth: 80 }}>{shown ? RATING_WORDS[shown] : ""}</span>
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, fontWeight: 700 }}>
        <span>
          {texts.commentLabel} {texts.commentHint && <span style={{ fontWeight: 400, color: "#5b5f6b" }}>{texts.commentHint}</span>}
        </span>
        <textarea
          rows={4}
          maxLength={1500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={texts.commentPlaceholder}
          style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", font: "inherit", fontSize: 14, fontWeight: 400, background: "#fff", resize: "vertical" }}
        />
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          {texts.photosLabel} {texts.photosHint && <span style={{ fontWeight: 400, color: "#5b5f6b" }}>{texts.photosHint}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {photos.map((p) => (
            <div key={p.url} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 12, overflow: "hidden", background: "#f0efec" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- just-uploaded Blob URL */}
              <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <button type="button" aria-label="Quitar foto" onClick={() => setPhotos((prev) => prev.filter((x) => x.url !== p.url))} style={{ position: "absolute", top: 4, right: 4, width: 32, height: 32, borderRadius: "50%", border: "none", background: "#1c1310", color: "#fff", fontSize: 16, cursor: "pointer" }}>
                ×
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} style={{ aspectRatio: "1 / 1", borderRadius: 12, border: "1.5px dashed #c9c5bd", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: "#5b5f6b", font: "inherit", fontSize: 11 }}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5b5f6b" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              <span>{uploading ? "Subiendo…" : "Agregar"}</span>
            </button>
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => pickPhotos(e.target.files)} />
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13, fontWeight: 700 }}>
        <span>
          {texts.instagramLabel} {texts.instagramHint && <span style={{ fontWeight: 400, color: "#5b5f6b" }}>{texts.instagramHint}</span>}
        </span>
        <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@tu_usuario" maxLength={60} style={{ width: "100%", boxSizing: "border-box", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", font: "inherit", fontSize: 14, fontWeight: 400, background: "#fff" }} />
      </label>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, cursor: "pointer" }}>
        <input type="checkbox" checked={publishConsent} onChange={(e) => setPublishConsent(e.target.checked)} style={{ width: 20, height: 20, margin: "1px 0 0", accentColor: "#00beb5", flex: "0 0 auto" }} />
        <span>{texts.consentText}</span>
      </label>

      {raffle?.open && (
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.45, cursor: "pointer" }}>
          <input type="checkbox" checked={raffleOptIn} onChange={(e) => setRaffleOptIn(e.target.checked)} style={{ width: 20, height: 20, margin: "1px 0 0", accentColor: "#00beb5", flex: "0 0 auto" }} />
          <span>{texts.raffleOptInText}</span>
        </label>
      )}

      {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}

      <button type="button" onClick={submit} disabled={submitting || uploading} style={{ width: "100%", height: 52, border: "none", borderRadius: 14, background: "var(--accent)", color: "#0b2e2c", font: "inherit", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
        {submitting ? "Enviando…" : texts.submitLabel}
      </button>
      {texts.formFootnote && <p style={{ margin: 0, fontSize: 11.5, color: "#5b5f6b", lineHeight: 1.45, textAlign: "center" }}>{texts.formFootnote}</p>}
    </main>
  );
}
