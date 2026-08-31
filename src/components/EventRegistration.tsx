"use client";

import { useEffect, useRef, useState } from "react";
import { Fraunces } from "next/font/google";
import RegistrationForm, { type QuestionView, type RegisterPayload } from "./RegistrationForm";
import { track, ensureFbcCookie } from "./tracking";

// Same face the admin already uses for its own brand/celebratory moments
// (EventForm.tsx, the CRM/Settings section headers) — one display font for
// "this is a brand moment" across the whole app, not a second one just for
// this screen.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

const INSTAGRAM_URL = "https://www.instagram.com/nailfest_co";

export interface PublicTicketTypeView {
  id: string;
  name: string;
  price: number;
  minPerOrder: number;
  maxPerOrder: number;
  remaining: number;
}

interface Props {
  eventSlug: string;
  eventName: string;
  eventCity: string;
  eventWhen: string; // pre-formatted "Sáb 5 sep 2026, 10:00 a. m. - dom 6 sep 2026, 5:00 p. m."
  eventVenue: string; // pre-formatted "Lugar — Dirección", or "" if neither is set
  professionOptions: string[];
  questions: QuestionView[];
  ticketTypes: PublicTicketTypeView[];
  registerButtonLabel: string;
  // OrgSettings.name — "Nail Fest" by default, but admin-editable, so the
  // confirmation wordmark stays correct if that ever changes instead of
  // hardcoding the brand name here.
  brandName: string;
  // OrgSettings.replyToEmail (/admin/settings/contact) — the real address
  // people's email replies already land on. Reused here as the "¿ese
  // correo no es tuyo?" escape hatch instead of inventing a new contact
  // channel; the link is hidden entirely when this isn't configured
  // rather than rendering a dead mailto:.
  supportEmail: string | null;
  // Already-sanitized (sanitizeHtml.ts) event.description — rendered here
  // rather than by [eventSlug]/page.tsx itself so the description and the
  // sticky sidebar info card (desktop only, see globals.css's
  // .event-page-body) can live in the same two-column grid: this
  // component owns eventName/eventWhen/eventVenue/registerButtonLabel
  // already, so the sidebar's own copy of that info renders from here
  // too instead of needing that state lifted back up into the (server
  // component) page.
  descriptionHtml: string | null;
}

// One combined checkout step (Shopify-style, per the admin's own call —
// with no payment step to protect, a separate "review before you submit"
// screen was pure friction) — ticket quantity (if any) and the form
// together, one button that really submits. "Resumen" is the destination
// AFTER that submit (the confirmation), not a step you pass through
// before it.
type Step = "checkout" | "resumen";

export default function EventRegistration({
  eventSlug,
  eventName,
  eventCity,
  eventWhen,
  eventVenue,
  professionOptions,
  questions,
  ticketTypes,
  registerButtonLabel,
  brandName,
  supportEmail,
  descriptionHtml,
}: Props) {
  const hasTicketTypes = ticketTypes.length > 0;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("checkout");
  // The real email just submitted — shown back on the confirmation screen
  // so the person knows exactly where to look for their QR (and, if it's
  // wrong, that they typed it wrong). Cleared whenever the modal is
  // reopened for a fresh attempt (see openModal below).
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  // Only pre-select when there's exactly one type AND it actually has
  // stock — a single sold-out type must NOT default to a nonzero
  // quantity, or the submit button would wrongly enable with nothing
  // real behind it.
  const onlyType = ticketTypes.length === 1 && (ticketTypes[0]?.remaining ?? 0) > 0 ? ticketTypes[0] : undefined;
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<string | null>(onlyType?.id ?? null);
  const [quantity, setQuantity] = useState<number>(onlyType?.minPerOrder ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firedCheckoutStart = useRef(false);
  const inlineButtonRef = useRef<HTMLDivElement>(null);
  // Floating CTA only appears once the inline one (right after the venue,
  // in [eventSlug]/page.tsx's own layout) has scrolled out of view — the
  // user's own instruction after seeing it float the whole time regardless
  // of scroll position, sitting on top of content the entire page. Real
  // scroll-position tracking, not a fixed delay/pixel guess: an
  // IntersectionObserver on the inline button itself, so this stays
  // correct regardless of how tall the venue/description content above
  // and around it ends up being for any given event.
  const [showFloating, setShowFloating] = useState(false);

  useEffect(() => {
    // Reconstruct _fbc from ?fbclid= BEFORE the first track() call, since
    // there's no Meta Pixel on this site to set it automatically — see
    // ensureFbcCookie()'s own comment for why this matters.
    ensureFbcCookie();
    track("PageView");
    track("ViewContent");
  }, []);

  useEffect(() => {
    const el = inlineButtonRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => entry && setShowFloating(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function openModal() {
    setOpen(true);
    if (!firedCheckoutStart.current) {
      firedCheckoutStart.current = true;
      track("InitiateCheckout");
    }
  }

  function closeModal() {
    setOpen(false);
  }

  const selectedType = ticketTypes.find((t) => t.id === selectedTicketTypeId) ?? null;
  const requiresTicketPick = hasTicketTypes && !selectedType;

  function setTypeQuantity(typeId: string, next: number) {
    const type = ticketTypes.find((t) => t.id === typeId);
    if (!type) return;
    if (next <= 0) {
      setSelectedTicketTypeId(null);
      setQuantity(0);
      return;
    }
    const clamped = Math.min(Math.max(next, type.minPerOrder), Math.min(type.maxPerOrder, type.remaining));
    // Only one ticket type per registration today (Registration has a
    // single ticketTypeId/ticketCount pair, not a cart of line items) —
    // picking a quantity on one type resets any other back to 0 instead
    // of silently only keeping the last one server-side.
    setSelectedTicketTypeId(typeId);
    setQuantity(clamped);
  }

  async function handleSubmitPayload(payload: RegisterPayload) {
    setSubmitting(true);
    setSubmitError(null);

    // Shared with the server-side CAPI Purchase call (see /api/register)
    // so Meta dedupes the Pixel + CAPI pair instead of double-counting —
    // same mechanism as track() in tracking.ts, see MetaPixelScript.tsx.
    const purchaseEventId = crypto.randomUUID();
    if (payload.consents.advertising) {
      window.fbq?.("track", "Purchase", {}, { eventID: purchaseEventId });
    }
    const bodyToSend: RegisterPayload = {
      ...payload,
      ticketTypeId: selectedType?.id,
      ticketCount: selectedType ? quantity : undefined,
      purchaseEventId,
    };

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyToSend),
    });

    setSubmitting(false);
    if (res.ok) {
      setSubmittedEmail(payload.email);
      setStep("resumen");
    } else {
      const body = await res.json().catch(() => ({}));
      setSubmitError(
        body?.error === "event_not_found"
          ? "Este evento ya no está disponible."
          : body?.error === "not_permitted"
            ? "No podemos completar tu registro con este correo."
            : body?.error === "missing_required_fields"
              ? "Faltan campos obligatorios — revisa el formulario."
              : body?.error === "email_mismatch"
                ? "Los correos no coinciden — revísalos."
                : body?.error === "sold_out"
                  ? "Justo se agotaron las entradas de este tipo mientras llenabas el formulario."
                  : body?.error === "invalid_ticket_quantity"
                    ? "La cantidad elegida ya no es válida — ajústala arriba."
                    : "Algo salió mal, intenta de nuevo."
      );
    }
  }

  return (
    <>
      {/* Two-column body on desktop (see globals.css's .event-page-body) —
          content (inline CTA + description) on the left, a sticky info
          card repeating date/venue/CTA on the right, same shape as Ticket
          Tailor's own event page. Below the ~900px breakpoint this
          collapses to a single column and the sidebar is hidden entirely
          (display:none) — the mobile experience is untouched, just the
          inline CTA below and the floating one further down. */}
      <div className="event-page-body">
        <div className="event-page-content">
          {/* Inline CTA — sits in normal page flow at the top of the
              content column. The ref is what the floating CTA below
              watches to know when to take over (mobile only). */}
          <div ref={inlineButtonRef} className="event-inline-cta">
            <button type="button" className="primary" onClick={openModal}>
              {registerButtonLabel}
            </button>
          </div>

          {descriptionHtml && (
            // Sanitized server-side before it was ever stored
            // (lib/sanitizeHtml.ts, used by lib/events.ts's
            // createEvent/updateEvent) — this is the one place that
            // sanitizing has to hold, since this renders on an
            // unauthenticated public page.
            <div className="event-description" dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
          )}
        </div>

        <aside className="event-page-sidebar">
          <div className="event-page-sidebar-card">
            <h2>{eventName}</h2>
            {/* Fecha/hora deliberadamente NO se repite aquí — ya está
                arriba del todo, en el header de la página (ver
                [eventSlug]/page.tsx), y quedaba redundante en esta
                tarjeta. La tarjeta mantiene el lugar + el CTA. */}
            {eventVenue && (
              <p className="event-page-sidebar-meta">
                <PinIcon /> {eventVenue}
              </p>
            )}
            <button type="button" className="primary" onClick={openModal} style={{ marginTop: 4 }}>
              {registerButtonLabel}
            </button>
          </div>
        </aside>
      </div>

      {/* Floating CTA — mobile only (hidden ≥900px, see globals.css's
          .event-floating-cta — the sidebar card above is always visible
          on desktop, so a floating bar on top of it is redundant there).
          Only once the inline one above has scrolled out of view,
          centered within the page's own column instead of pinned to the
          raw viewport edge so it doesn't drift off on a wide screen. */}
      {!open && showFloating && (
        <div className="event-floating-cta">
          <div style={{ width: "100%", maxWidth: 440 }}>
            <button
              type="button"
              className="primary"
              onClick={openModal}
              style={{ boxShadow: "0 8px 24px -6px rgba(0,0,0,0.35)" }}
            >
              {registerButtonLabel}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(28,19,16,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #e3e1dc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                {/* Fecha/lugar ya no se repiten aquí — quedan arriba del botón
                    flotante, en la página misma (ver [eventSlug]/page.tsx),
                    así que mostrarlos otra vez en el modal era redundante. */}
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{eventName}</h2>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  aria-label="Cerrar"
                  style={{ border: "none", background: "transparent", fontSize: 22, lineHeight: 1, cursor: "pointer", color: "#5b5f6b" }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              {step === "checkout" && (
                <>
                  {hasTicketTypes && (
                    <div style={{ marginBottom: 24 }}>
                      <h3 style={{ fontSize: 15, marginTop: 0 }}>Seleccionar entradas</h3>
                      {ticketTypes.map((t) => {
                        const currentQty = selectedTicketTypeId === t.id ? quantity : 0;
                        const soldOut = t.remaining <= 0;
                        const effectiveMax = Math.min(t.maxPerOrder, t.remaining);
                        return (
                          <div
                            key={t.id}
                            style={{
                              border: "1px solid #e3e1dc",
                              borderRadius: 10,
                              padding: "14px 16px",
                              marginBottom: 10,
                              opacity: soldOut ? 0.5 : 1,
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{t.name}</div>
                                <div style={{ fontSize: 13, color: "#5b5f6b", textTransform: "uppercase" }}>
                                  {soldOut ? "AGOTADO" : t.price > 0 ? `$${t.price.toLocaleString("es-CO")}` : "GRATUITO"}
                                </div>
                              </div>
                              {!soldOut && (
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <StepperButton disabled={currentQty <= 0} onClick={() => setTypeQuantity(t.id, currentQty - 1)}>
                                    −
                                  </StepperButton>
                                  <span style={{ width: 24, textAlign: "center", fontWeight: 600 }}>{currentQty}</span>
                                  <StepperButton
                                    disabled={currentQty >= effectiveMax}
                                    onClick={() => setTypeQuantity(t.id, currentQty <= 0 ? t.minPerOrder : currentQty + 1)}
                                  >
                                    +
                                  </StepperButton>
                                </div>
                              )}
                            </div>
                            {/* Sutil, no un CTA — solo aclara el tope real (cupo restante
                                incluido) para que no toquen "+" esperando más de lo que hay. */}
                            {!soldOut && effectiveMax > 1 && (
                              <p style={{ fontSize: 12, color: "#8a8f9c", margin: "8px 0 0" }}>
                                Puedes seleccionar hasta {effectiveMax} entradas
                                {effectiveMax === 2 ? " (una para ti, una para tu acompañante)" : ""}.
                              </p>
                            )}
                          </div>
                        );
                      })}
                      {requiresTicketPick && (
                        <p style={{ fontSize: 13, color: "#5b5f6b", margin: "4px 0 0" }}>Elige una cantidad para continuar.</p>
                      )}
                      <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "20px 0" }} />
                    </div>
                  )}

                  <fieldset disabled={requiresTicketPick} style={{ border: "none", padding: 0, margin: 0, opacity: requiresTicketPick ? 0.5 : 1 }}>
                    <RegistrationForm
                      eventSlug={eventSlug}
                      professionOptions={professionOptions}
                      questions={questions}
                      ticketTypeId={selectedType?.id}
                      ticketCount={selectedType ? quantity : undefined}
                      onSubmitPayload={handleSubmitPayload}
                      submitting={submitting}
                      submitLabel={registerButtonLabel}
                    />
                  </fieldset>
                  {submitError && <p style={{ color: "#c2185b", fontSize: 13 }}>{submitError}</p>}
                </>
              )}

              {step === "resumen" && (
                <div style={{ position: "relative", textAlign: "center", padding: "8px 0 16px", overflow: "hidden" }}>
                  {/* A few brand-colored confetti dots, not a full animation —
                      the celebratory touch the plain "¡Listo!" was missing,
                      kept to the brand's own two colors (teal + peach) per
                      the ask to keep this turquesa, not a rainbow. */}
                  <span aria-hidden="true" style={{ position: "absolute", left: "8%", top: "2%", width: 7, height: 12, background: "var(--accent-secondary)", borderRadius: 2, transform: "rotate(16deg)", opacity: 0.85 }} />
                  <span aria-hidden="true" style={{ position: "absolute", left: "85%", top: 0, width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} />
                  <span aria-hidden="true" style={{ position: "absolute", left: "20%", top: "16%", width: 5, height: 5, borderRadius: "50%", background: "var(--accent)" }} />
                  <span aria-hidden="true" style={{ position: "absolute", left: "76%", top: "10%", width: 6, height: 6, borderRadius: "50%", background: "var(--accent-secondary)", opacity: 0.9 }} />
                  <span aria-hidden="true" style={{ position: "absolute", left: "93%", top: "18%", width: 6, height: 10, background: "var(--accent)", borderRadius: 2, transform: "rotate(-20deg)", opacity: 0.8 }} />

                  <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--link)", margin: "0 0 10px", position: "relative" }}>
                    {brandName}
                  </p>

                  <div style={{ position: "relative", display: "flex", justifyContent: "center", margin: "0 0 14px" }}>
                    <div
                      style={{
                        width: 122,
                        height: 122,
                        borderRadius: "50%",
                        background: "#fff",
                        border: "2.5px dashed var(--accent)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: "rotate(-5deg)",
                        boxShadow: "0 12px 26px -12px rgba(0,190,181,0.5)",
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: "var(--accent)",
                          color: "var(--accent-ink)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          fontWeight: 900,
                          marginBottom: 5,
                        }}
                      >
                        ✓
                      </span>
                      <b className={fraunces.className} style={{ fontSize: 12.5, lineHeight: 1.2, textAlign: "center" }}>
                        YA ESTÁS
                        <br />
                        REGISTRADA
                      </b>
                    </div>
                  </div>

                  <h2 className={fraunces.className} style={{ fontSize: 21, fontWeight: 900, margin: "0 0 10px", position: "relative" }}>
                    ¡Nos vemos en {brandName} {eventCity}!
                  </h2>

                  <p style={{ fontSize: 13.5, color: "#5b5f6b", margin: "0 0 10px", position: "relative" }}>
                    Tu entrada con el <strong>código QR</strong> ya va camino a tu correo:
                  </p>

                  {submittedEmail && (
                    <div
                      style={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        background: "#e6f9f7",
                        border: "1px solid #b7e8e3",
                        borderRadius: 10,
                        padding: "8px 12px",
                        maxWidth: "100%",
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="2" style={{ width: 15, height: 15, flex: "0 0 auto" }}>
                        <rect x="3" y="5" width="18" height="14" rx="2.5" />
                        <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
                      </svg>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent-ink)", wordBreak: "break-all" }}>{submittedEmail}</span>
                    </div>
                  )}

                  {supportEmail && (
                    <p style={{ fontSize: 11, color: "#8a8f9c", margin: "8px 0 0", position: "relative" }}>
                      ¿Ese correo no es tuyo?{" "}
                      <a
                        href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Corregir mi correo — ${eventName}`)}&body=${encodeURIComponent(
                          `Hola, me registré a ${eventName} pero creo que escribí mal mi correo (quedó como: ${submittedEmail ?? ""}).\n\nMi nombre:\nMi teléfono:\nMi correo correcto:`
                        )}`}
                        style={{ color: "var(--link)", fontWeight: 700 }}
                      >
                        Escríbenos
                      </a>
                    </p>
                  )}

                  <div
                    style={{
                      position: "relative",
                      marginTop: 18,
                      background: "#fff",
                      border: "1.5px solid var(--accent)",
                      borderRadius: 16,
                      padding: "12px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 11,
                        flex: "0 0 auto",
                        background: "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="1.8" style={{ width: 19, height: 19 }}>
                        <rect x="2" y="2" width="20" height="20" rx="6" />
                        <circle cx="12" cy="12" r="4.2" />
                        <circle cx="17.4" cy="6.6" r="1.1" fill="var(--accent-ink)" stroke="none" />
                      </svg>
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0 }}>@nailfest_co</p>
                      <p style={{ fontSize: 11, color: "#5b5f6b", margin: "1px 0 0" }}>Síguenos para más noticias del evento</p>
                    </div>
                    <a
                      href={INSTAGRAM_URL}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: "0 0 auto",
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: "var(--accent-ink)",
                        background: "var(--accent)",
                        borderRadius: 999,
                        padding: "7px 13px",
                        whiteSpace: "nowrap",
                        textDecoration: "none",
                      }}
                    >
                      Seguir
                    </a>
                  </div>

                  <button type="button" className="secondary" onClick={closeModal} style={{ maxWidth: 200, margin: "18px auto 0", position: "relative" }}>
                    Cerrar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Small line icon for the sidebar info card's venue row — same inline-SVG
// style already used above for the resumen step's envelope and Instagram
// icons, not emoji, to match the app's established look there.
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ width: 15, height: 15, flex: "0 0 auto" }}>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

function StepperButton({ children, disabled, onClick }: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        border: "1px solid #e3e1dc",
        background: disabled ? "#f6f5f2" : "#fff",
        color: disabled ? "#c8c4bb" : "#1c1310",
        cursor: disabled ? "default" : "pointer",
        fontSize: 16,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}
