"use client";

import { useEffect, useRef, useState } from "react";
import RegistrationForm, { type QuestionView, type RegisterPayload } from "./RegistrationForm";
import { track, ensureFbcCookie } from "./tracking";

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
  eventWhen: string; // pre-formatted "Sáb 5 sep 2026, 10:00 a. m. - dom 6 sep 2026, 5:00 p. m."
  eventVenue: string; // pre-formatted "Lugar — Dirección", or "" if neither is set
  professionOptions: string[];
  questions: QuestionView[];
  ticketTypes: PublicTicketTypeView[];
  registerButtonLabel: string;
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
  eventWhen,
  eventVenue,
  professionOptions,
  questions,
  ticketTypes,
  registerButtonLabel,
}: Props) {
  const hasTicketTypes = ticketTypes.length > 0;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("checkout");
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

  useEffect(() => {
    // Reconstruct _fbc from ?fbclid= BEFORE the first track() call, since
    // there's no Meta Pixel on this site to set it automatically — see
    // ensureFbcCookie()'s own comment for why this matters.
    ensureFbcCookie();
    track("PageView");
    track("ViewContent");
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
      {/* Floating CTA — always visible regardless of scroll position,
          centered within the page's own column instead of pinned to the
          raw viewport edge so it doesn't drift off on a wide screen. */}
      {!open && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 16, display: "flex", justifyContent: "center", zIndex: 40, padding: "0 20px" }}>
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
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <h2>¡Listo!</h2>
                  <p>Revisa tu correo — ahí va tu entrada con el código QR.</p>
                  <button type="button" className="primary" onClick={closeModal} style={{ maxWidth: 240, margin: "16px auto 0" }}>
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
