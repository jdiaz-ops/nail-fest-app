import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { fetchTransaction } from "@/lib/payments/wompi";
import { confirmRegistrationPayment, type ConfirmResult } from "@/lib/payments/confirmRegistrationPayment";

export const dynamic = "force-dynamic";

// Wompi's own redirect-url target (see lib/payments/wompi.ts's
// buildCheckoutUrl — we pass this exact path + ?registrationId=, Wompi
// appends its own ?id=<transactionId> on top). This is the SYNCHRONOUS
// confirmation path: the customer's browser lands here right after
// paying, so it checks Wompi directly and confirms right then — it does
// NOT just wait on the async webhook (see /api/webhooks/wompi), which is
// the eventual-consistency backstop for when this page never gets a
// chance to run at all (closed tab, no redirect, etc.). Whichever of the
// two gets there first does the real work — see
// confirmRegistrationPayment's own comment on the race.
export default async function PaymentReturnPage({
  params,
  searchParams,
}: {
  params: { eventSlug: string };
  searchParams: { registrationId?: string; id?: string };
}) {
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { slug: params.eventSlug } }), getOrgSettings()]);

  let result: ConfirmResult | "unknown" = "unknown";
  if (searchParams.id) {
    const transaction = await fetchTransaction(searchParams.id);
    result = transaction ? await confirmRegistrationPayment(transaction) : "error";
  } else if (searchParams.registrationId) {
    // No transaction id at all — Wompi's own redirect should always
    // include one, so this is an unusual path (direct visit, a bookmark,
    // a very unusual Wompi failure). Fall back to whatever this
    // registration's own status already says, which the webhook may have
    // already set.
    const registration = await db.registration.findUnique({ where: { id: searchParams.registrationId } });
    result = registration?.status === "CONFIRMED" ? "approved" : registration?.status === "PENDING_PAYMENT" ? "pending" : "not_found";
  }

  // Read back regardless of which branch above actually confirmed the
  // payment — by the time either one returns, confirmRegistrationPayment
  // has already persisted zoomJoinUrl onto the row (see
  // registrationConfirmation.ts's own comment on why it's persisted, not
  // just handed to the email). Lets THIS page show the join button right
  // away too, instead of the person only getting it by opening their
  // email — the whole point of adapting this landing page.
  const registration = searchParams.registrationId
    ? await db.registration.findUnique({ where: { id: searchParams.registrationId }, select: { zoomJoinUrl: true } })
    : null;

  const brandName = orgSettings.name;
  const eventName = event?.name ?? "tu evento";
  const isVirtualOnly = event?.format === "VIRTUAL";

  const COPY: Record<ConfirmResult | "unknown", { title: string; body: string; tone: "ok" | "warn" | "bad" }> = {
    approved: {
      title: "¡Pago confirmado!",
      body: isVirtualOnly
        ? `Tu registro para ${eventName} quedó listo. Únete por Zoom con el botón de abajo, o revisa tu correo — ahí también te llega el mismo link.`
        : `Tu entrada para ${eventName} quedó lista — revisa tu correo, ahí te llega toda la información.`,
      tone: "ok",
    },
    pending: {
      title: "Estamos confirmando tu pago",
      body: "Algunos métodos de pago (como PSE) tardan unos minutos en confirmarse. En cuanto quede lista, te llega un correo con tu entrada — no hace falta que vuelvas a intentarlo.",
      tone: "warn",
    },
    declined: {
      title: "El pago no se pudo procesar",
      body: "Tu banco o el medio de pago rechazó la transacción. Puedes volver a intentarlo con otro medio de pago.",
      tone: "bad",
    },
    voided: {
      title: "El pago fue anulado",
      body: "Esta transacción fue anulada. Puedes volver a intentar tu registro.",
      tone: "bad",
    },
    error: {
      title: "No pudimos confirmar tu pago",
      body: "Algo salió mal verificando la transacción. Si alcanzaste a pagar, escríbenos y lo confirmamos manualmente con Wompi.",
      tone: "bad",
    },
    not_found: {
      title: "No encontramos ese pago",
      body: "Este link no corresponde a ningún registro que tengamos. Si acabas de pagar, escríbenos.",
      tone: "bad",
    },
    unknown: {
      title: "No pudimos verificar tu pago",
      body: "Falta información en el link para confirmar tu pago. Si acabas de pagar, escríbenos.",
      tone: "bad",
    },
  };
  const copy = COPY[result];
  const toneColor = copy.tone === "ok" ? "var(--accent-ink)" : copy.tone === "warn" ? "#8a5a1f" : "#a3251f";
  const toneBg = copy.tone === "ok" ? "#e6f9f7" : copy.tone === "warn" ? "#fdf1e6" : "#fdeaea";

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--link)", margin: "0 0 16px" }}>
        {brandName}
      </p>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: toneBg,
          color: toneColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: 28,
          fontWeight: 800,
        }}
      >
        {copy.tone === "ok" ? "✓" : copy.tone === "warn" ? "…" : "!"}
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>{copy.title}</h1>
      <p style={{ fontSize: 14.5, color: "#5b5f6b", margin: "0 0 24px" }}>{copy.body}</p>
      {result === "approved" && registration?.zoomJoinUrl && (
        <a
          href={registration.zoomJoinUrl}
          style={{
            display: "inline-block",
            textDecoration: "none",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            borderRadius: 8,
            padding: "12px 24px",
            fontWeight: 700,
            marginBottom: 16,
          }}
        >
          Entrar a la sesión de Zoom
        </a>
      )}
      {result === "approved" && registration?.zoomJoinUrl && <br />}
      {event && copy.tone === "bad" ? (
        <a
          href={`/${event.slug}`}
          style={{
            display: "inline-block",
            textDecoration: "none",
            background: "var(--accent)",
            color: "var(--accent-ink)",
            borderRadius: 8,
            padding: "12px 24px",
            fontWeight: 600,
          }}
        >
          Volver al evento
        </a>
      ) : (
        event && (
          <a href={`/${event.slug}`} style={{ fontSize: 13, color: "var(--link)" }}>
            Volver a la página del evento
          </a>
        )
      )}
    </main>
  );
}
