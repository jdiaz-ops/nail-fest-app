"use client";

import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand";

// Nail Fest's screen right after signing up to one of its events at a place
// (2026-10-30, the boceto the team approved; Event.signupScreenDesign
// "NAIL_FEST", switched on in «Después de la inscripción»): the usual one —
// the stamp, «¡Nos vemos en Nail Fest Cúcuta!», where her ticket went
// (without her email and number) and the Instagram —, and under it her
// «Asistiré» image and an invitation for a colleague. Shown by
// EventRegistration.tsx in place of its usual screen.

/** The event's part, the same for everyone (lib/nailfest/signup.ts). */
export interface NailFestSignupScreen {
  /** WhatsApp with the invitation written, the page's link at the end. */
  shareUrl: string;
  free: boolean;
}

/** Hers, from /api/register: her page to make her «Asistiré» image. */
export interface NailFestSignupResult {
  asistire: string;
}

export default function NailFestSignedUp({
  screen,
  result,
  brandName,
  eventCity,
  whatsapp,
  displayFont,
  inAppBrowser,
  onClose,
}: {
  screen: NailFestSignupScreen;
  result: NailFestSignupResult;
  brandName: string;
  eventCity: string;
  /** Whether her ticket went to her WhatsApp too. */
  whatsapp: boolean;
  /** The display face's class (Fraunces, from EventRegistration). */
  displayFont: string;
  inAppBrowser: boolean;
  onClose: () => void;
}) {
  const external = inAppBrowser ? {} : { target: "_blank", rel: "noreferrer" };

  return (
    <div className="nf-ok">
      <span aria-hidden="true" className="nf-ok-bit" style={{ left: "8%", top: "2%", width: 7, height: 12, borderRadius: 2, background: "var(--accent-secondary)", transform: "rotate(16deg)" }} />
      <span aria-hidden="true" className="nf-ok-bit" style={{ left: "85%", top: 0, width: 6, height: 6, background: "var(--accent)" }} />
      <span aria-hidden="true" className="nf-ok-bit" style={{ left: "20%", top: "11%", width: 5, height: 5, background: "var(--accent)" }} />
      <span aria-hidden="true" className="nf-ok-bit" style={{ left: "76%", top: "7%", width: 6, height: 6, background: "var(--accent-secondary)" }} />
      <span aria-hidden="true" className="nf-ok-bit" style={{ left: "93%", top: "13%", width: 6, height: 10, borderRadius: 2, background: "var(--accent)", transform: "rotate(-20deg)" }} />

      <p className="nf-ok-brand">{brandName}</p>
      <div className="nf-ok-stamp">
        <span aria-hidden="true">✓</span>
        <b className={displayFont}>
          YA ESTÁS
          <br />
          REGISTRADA
        </b>
      </div>
      <h2 className={`nf-ok-h ${displayFont}`}>
        ¡Nos vemos en {brandName} {eventCity}!
      </h2>
      <p className="nf-ok-sent">
        <strong>Tu entrada</strong> ya va camino a tu correo{whatsapp ? " y WhatsApp" : ""}.
      </p>

      <a className="nf-ok-ig" href={INSTAGRAM_URL} {...external}>
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="1.8">
            <rect x="2" y="2" width="20" height="20" rx="6" />
            <circle cx="12" cy="12" r="4.2" />
            <circle cx="17.4" cy="6.6" r="1.1" fill="var(--accent-ink)" stroke="none" />
          </svg>
        </span>
        <div>
          <b>{INSTAGRAM_HANDLE}</b>
          <small>Síguenos para más noticias del evento</small>
        </div>
        <i>Seguir</i>
      </a>

      <div className="nf-ok-asis">
        {/* eslint-disable-next-line @next/next/no-img-element -- a sample of the image, small */}
        <img src="/nailfest/asistire-muestra.jpg" alt="" width={58} height={78} />
        <div>
          <b>¡Cuéntale a todos que vas!</b>
          <small>Tu foto en la imagen «Asistiré», para tus historias.</small>
          <a className="nf-ok-btn" href={result.asistire} {...external}>
            Crear mi imagen
          </a>
        </div>
      </div>

      <div className="nf-ok-colega">
        <b>¿Vas con una colega?</b>
        <small>{screen.free ? "La entrada es gratis: compártele el enlace para que se inscriba." : "Compártele el enlace para que se inscriba."}</small>
        <a className="nf-ok-btn nf-ok-btn-white" href={screen.shareUrl} {...external}>
          Compartir por WhatsApp
        </a>
      </div>

      <button type="button" className="nf-ok-close" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}
