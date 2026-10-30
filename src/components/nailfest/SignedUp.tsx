"use client";

import { formatPhoneDisplay, INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand";

// Nail Fest's screen right after signing up to one of its events at a place
// (2026-10-30, the boceto the team approved; Event.signupScreenDesign
// "NAIL_FEST", switched on in «Después de la inscripción»): her ticket's QR
// right there — a screenshot already gets her in, even before the email
// arrives —, where her ticket also went, the days and the place with «Cómo
// llegar», her «Asistiré» image, an invitation for a colleague and the
// Instagram. Shown by EventRegistration.tsx in place of its usual screen.

/** The event's part, the same for everyone (lib/nailfest/signup.ts). */
export interface NailFestSignupScreen {
  /** «Cúcuta» */
  city: string;
  /** «Sábado 7 y domingo 8 de noviembre» */
  dates: string;
  /** «10:00 a. m. a 6:00 p. m.» — or, when the days differ, one line each: «Sábado 7: desde las 10:00 a. m.» */
  hours: string[];
  venue: { name: string | null; address: string | null; mapsUrl: string | null };
  /** WhatsApp with the invitation written, the page's link at the end. */
  shareUrl: string;
  free: boolean;
}

/** Hers, from /api/register. */
export interface NailFestSignupResult {
  /** Her ticket(s) — none when she was already signed up: they went to her email again. */
  tickets: { qr: string; holder: string; label: string; code: string }[];
  asistire: string;
}

export default function NailFestSignedUp({
  screen,
  result,
  firstName,
  email,
  phone,
  displayFont,
  inAppBrowser,
  onClose,
}: {
  screen: NailFestSignupScreen;
  result: NailFestSignupResult;
  firstName: string | null;
  email: string | null;
  /** Her number, when her ticket went to her WhatsApp too. */
  phone: string | null;
  /** The display face's class (Fraunces, from EventRegistration). */
  displayFont: string;
  inAppBrowser: boolean;
  onClose: () => void;
}) {
  const name = firstName?.trim().split(/\s+/)[0];
  const again = result.tickets.length === 0;
  const external = inAppBrowser ? {} : { target: "_blank", rel: "noreferrer" };

  return (
    <div className="nf-ok">
      <span aria-hidden="true" className="nf-ok-bit" style={{ left: "8%", top: "1%", width: 7, height: 7, background: "var(--accent-secondary)" }} />
      <span aria-hidden="true" className="nf-ok-bit" style={{ left: "86%", top: 0, width: 6, height: 6, background: "var(--accent)" }} />
      <span
        aria-hidden="true"
        className="nf-ok-bit"
        style={{ left: "92%", top: "4%", width: 6, height: 10, borderRadius: 2, background: "var(--accent)", transform: "rotate(-20deg)" }}
      />

      <div className="nf-ok-stamp">
        <span aria-hidden="true">✓</span>
        <b className={displayFont}>
          YA ESTÁS
          <br />
          REGISTRADA
        </b>
      </div>
      <h2 className={`nf-ok-h ${displayFont}`}>{`¡Nos vemos en ${screen.city}${name ? `, ${name}` : ""}!`}</h2>

      {result.tickets.map((t) => (
        <div key={t.code} className="nf-ok-ticket">
          <div className="nf-ok-ticket-top">
            <span>Tu entrada · tómale captura</span>
            <b>{t.code}</b>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- her ticket's QR, drawn by /api/ticket-qr */}
          <img src={t.qr} alt={`Código QR de la entrada de ${t.holder}`} width={170} height={170} />
          <p className="nf-ok-ticket-name">{t.holder}</p>
          <span className="nf-ok-ticket-pill">{t.label}</span>
          <p className="nf-ok-ticket-foot">Muéstrala en la entrada</p>
        </div>
      ))}

      {(email || phone) && (
        <>
          <p className="nf-ok-sent">{again ? "Ya estabas inscrita. Te reenviamos tu entrada a:" : "También te la enviamos a:"}</p>
          <div className="nf-ok-chips">
            {email && (
              <span className="nf-ok-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
                </svg>
                {email}
              </span>
            )}
            {phone && (
              <span className="nf-ok-chip">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6.5 3h11a3.5 3.5 0 0 1 3.5 3.5v9a3.5 3.5 0 0 1-3.5 3.5H10l-4 3v-3H6.5A3.5 3.5 0 0 1 3 15.5v-9A3.5 3.5 0 0 1 6.5 3Z" />
                  <path d="M7.5 9.5h9M7.5 13h6" />
                </svg>
                WhatsApp {formatPhoneDisplay(phone)}
              </span>
            )}
          </div>
        </>
      )}

      <div className="nf-ok-info">
        <b>{screen.dates}</b>
        {screen.hours.map((line) => (
          <small key={line}>{line}</small>
        ))}
        {screen.venue.name && <b className="nf-ok-info-place">{screen.venue.name}</b>}
        {screen.venue.address && <small>{screen.venue.address}</small>}
        {screen.venue.mapsUrl && (
          <a className="nf-ok-out" href={screen.venue.mapsUrl} {...external}>
            Cómo llegar
          </a>
        )}
      </div>

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
        <div>
          <b>¿Vas con una colega?</b>
          <small>{screen.free ? "La entrada es gratis." : "Invítala a inscribirse."}</small>
        </div>
        <a className="nf-ok-btn nf-ok-btn-white" href={screen.shareUrl} {...external}>
          Compartir por WhatsApp
        </a>
      </div>

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

      <button type="button" className="nf-ok-close" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}
