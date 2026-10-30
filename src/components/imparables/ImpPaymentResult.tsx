import type { Event } from "@prisma/client";
import type { ConfirmResult } from "@/lib/payments/confirmRegistrationPayment";
import { publicEventName } from "@/lib/eventDisplayName";
import { nextSteps, type ImparablesConfirmation } from "@/lib/imparables/confirmationEmail";
import { coverName } from "@/lib/imparables/schedule";
import { Tiara } from "./ImpArt";
import { cinzel, manrope } from "./fonts";

// The payment's answer for Manicuristas Imparables (/<event>/pago, 2026-10-30,
// as in the team's boceto): the confirmation email's header — the congress's
// name and day, no other brand — and a band in the answer's color. Paid: her
// hello, what happens now (the email's steps, her email and WhatsApp in one),
// her «Asistiré» image and the colleague to share it with. Still confirming:
// that it takes a few minutes and where the confirmation will arrive. Turned
// down: try again, straight to the checkout. The data is the confirmation's
// own (lib/imparables/confirmation.ts's imparablesAfterPayment).

type Answer = ConfirmResult | "unknown";

const NOT_PAID: Record<Exclude<Answer, "approved" | "pending">, { band: string; title: string; body: string; retry: boolean }> = {
  declined: {
    band: "Pago no procesado",
    title: "El pago no se pudo procesar",
    body: "Tu banco o el medio de pago rechazó la transacción. No se te cobró nada: puedes volver a intentarlo con otro medio de pago.",
    retry: true,
  },
  voided: { band: "Pago anulado", title: "El pago fue anulado", body: "Esta transacción se anuló. Puedes volver a intentarlo con otro medio de pago.", retry: true },
  error: {
    band: "Revisemos tu pago",
    title: "No pudimos confirmar tu pago",
    body: "Algo salió mal al verificar la transacción. Si alcanzaste a pagar, escríbenos y lo confirmamos.",
    retry: false,
  },
  not_found: { band: "Revisemos tu pago", title: "No encontramos ese pago", body: "Este enlace no corresponde a ninguna compra. Si acabas de pagar, escríbenos.", retry: false },
  unknown: {
    band: "Revisemos tu pago",
    title: "No pudimos verificar tu pago",
    body: "Falta información en el enlace para confirmar tu pago. Si acabas de pagar, escríbenos.",
    retry: false,
  },
};

export default function ImpPaymentResult({
  event,
  answer,
  data,
}: {
  event: Event;
  answer: Answer;
  data: { c: ImparablesConfirmation; email: string | null; asistire: string | null };
}) {
  const { c } = data;
  const words = coverName(publicEventName(event)).split(/\s+/);
  const big = words.pop() ?? "";
  const pre = words.join(" ");
  const notPaid = answer === "approved" || answer === "pending" ? null : NOT_PAID[answer];
  const help = c.helpUrl && (
    <p className="imp-pago-mas">
      ¿Dudas?{" "}
      <a href={c.helpUrl} target="_blank" rel="noreferrer">
        Escríbenos por WhatsApp
      </a>
    </p>
  );

  return (
    <main className={`imp imp-pago ${cinzel.variable} ${manrope.variable}`}>
      <header className="imp-pago-cab">
        <div className="imp-pago-rayos" aria-hidden="true" />
        <Tiara />
        <p className="imp-pago-name">
          {pre && <span>{pre}</span>}
          <b>{big}</b>
        </p>
        <p className="imp-pago-fecha">
          {c.date}
          {event.format === "IN_PERSON" ? "" : " · 100% en vivo"}
        </p>
      </header>

      {answer === "approved" ? (
        <>
          <p className="imp-pago-franja">✓&nbsp; Cupo confirmado</p>
          <div className="imp-pago-col">
            <section className="imp-pago-hola">
              <h1>{c.firstName ? `¡Lo lograste, ${c.firstName}!` : "¡Lo lograste!"}</h1>
              <p>
                Tu cupo para <b>{c.eventName}</b> está confirmado. Nadie nace imparable: se hace, y hoy diste el primer paso.
              </p>
            </section>
            <section className="imp-pago-pasos">
              <h2>¿Qué pasa ahora?</h2>
              <ol>
                {nextSteps(c, true).map(([title, body], i) => (
                  <li key={title}>
                    <span className="imp-pago-una" aria-hidden="true">
                      {i + 1}
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <span>{body}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            {data.asistire && (
              <section className="imp-pago-asis">
                <h2>¡Cuéntale a todos que vas!</h2>
                <p>Sube una foto tuya y te armamos tu imagen «Asistiré» para historias y publicaciones.</p>
                <a href={data.asistire} aria-hidden="true" tabIndex={-1}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- a fixed picture of the empty template */}
                  <img src="/imparables/asistire-muestra.jpg" width={150} height={266} alt="" />
                </a>
                <a className="imp-pago-btn" href={data.asistire}>
                  Crear mi imagen
                </a>
              </section>
            )}
          </div>
          <section className="imp-pago-colega">
            <div className="imp-pago-col">
              <h2>¿Conoces a una colega que lo necesita?</h2>
              <p>{c.share.line}</p>
              <a className="imp-pago-btn" href={c.share.url} target="_blank" rel="noreferrer">
                Compartir por WhatsApp
              </a>
            </div>
          </section>
        </>
      ) : answer === "pending" ? (
        <>
          <p className="imp-pago-franja is-wait">···&nbsp; Confirmando tu pago</p>
          <div className="imp-pago-col">
            <section className="imp-pago-estado">
              <div className="imp-pago-ico is-wait" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" />
                </svg>
              </div>
              <h1>Estamos confirmando tu pago</h1>
              <p>
                Algunos medios de pago, como PSE, tardan unos minutos en confirmarse. En cuanto quede listo te llega un correo con la confirmación de tu cupo:
                no hace falta que vuelvas a pagar.
              </p>
              {data.email && (
                <div className="imp-pago-correo">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                  <div>
                    Te escribiremos a <b>{data.email}</b>. Si no lo ves en unos minutos, revisa en spam.
                  </div>
                </div>
              )}
              {help}
            </section>
          </div>
        </>
      ) : (
        notPaid && (
          <>
            <p className="imp-pago-franja is-no">
              {notPaid.retry ? "✕" : "!"}&nbsp; {notPaid.band}
            </p>
            <div className="imp-pago-col">
              <section className="imp-pago-estado">
                <div className="imp-pago-ico is-no" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v6" />
                    <circle cx="12" cy="17" r=".6" fill="currentColor" />
                  </svg>
                </div>
                <h1>{notPaid.title}</h1>
                <p>{notPaid.body}</p>
                {notPaid.retry && (
                  <a className="imp-pago-btn" href={`/${event.slug}/checkout`}>
                    Volver a intentarlo
                  </a>
                )}
                {help}
              </section>
            </div>
          </>
        )
      )}
    </main>
  );
}
