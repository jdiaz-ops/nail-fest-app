import { Fraunces } from "next/font/google";
import { db } from "@/lib/db";
import { getOrgSettings } from "@/lib/settings";
import { fetchTransaction } from "@/lib/payments/wompi";
import { getPayPalOrder, settlementFromOrder } from "@/lib/payments/paypal";
import { confirmRegistrationPayment, settlePayment, type ConfirmResult } from "@/lib/payments/confirmRegistrationPayment";
import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand";
import { publicEventName } from "@/lib/eventDisplayName";
import PostPaymentQuestions from "@/components/PostPaymentQuestions";

export const dynamic = "force-dynamic";

// Same face the free-registration flow's own confirmation step uses
// (EventRegistration.tsx) — one display font for "this is a brand
// moment" across both confirmation paths, not a plainer one just
// because this page happens to be a server component.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

// Wompi's own redirect-url target (see lib/payments/wompi.ts's
// buildCheckoutUrl — we pass this exact path + ?registrationId=, Wompi
// appends its own ?id=<transactionId> on top). This is the SYNCHRONOUS
// confirmation path: the customer's browser lands here right after
// paying, so it checks Wompi directly and confirms right then — it does
// NOT just wait on the async events (see lib/payments/wompiEvents.ts), which are
// the eventual-consistency backstop for when this page never gets a
// chance to run at all (closed tab, no redirect, etc.). Whichever of the
// two gets there first does the real work — see
// confirmRegistrationPayment's own comment on the race. PayPal's buyers come
// here too (2026-10-29), sent by the one-page checkout once the capture
// answered, with ?paypal=<orderId>: the order is read from PayPal's API and
// settled the same way (a second time changes nothing).
export default async function PaymentReturnPage({
  params,
  searchParams,
}: {
  params: { eventSlug: string };
  searchParams: { registrationId?: string; id?: string; paypal?: string };
}) {
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { slug: params.eventSlug } }), getOrgSettings()]);

  let result: ConfirmResult | "unknown" = "unknown";
  if (searchParams.id) {
    // Read from Wompi's API here on the server (private key — the public
    // one, with a warning in the logs, until it's loaded), never on the
    // link's own word; and only a reference naming one of our payments
    // (NF-...) confirms anything — see confirmRegistrationPayment.
    const transaction = await fetchTransaction(searchParams.id);
    result = transaction ? await confirmRegistrationPayment(transaction) : "error";
  } else if (searchParams.paypal) {
    const order = await getPayPalOrder(searchParams.paypal);
    const settlement = order ? settlementFromOrder(order) : null;
    result = settlement ? await settlePayment(settlement) : "error";
  } else if (searchParams.registrationId) {
    // No transaction id at all — Wompi's own redirect should always
    // include one, so this is an unusual path (direct visit, a bookmark,
    // a very unusual Wompi failure). Fall back to whatever this
    // registration's own status already says, which the webhook may have
    // already set.
    const registration = await db.registration.findUnique({ where: { id: searchParams.registrationId } });
    result = registration?.status === "CONFIRMED" ? "approved" : registration?.status === "PENDING_PAYMENT" ? "pending" : "not_found";
  }

  // Paid, back from Wompi or PayPal: the optional question the one-page
  // checkout leaves for now (2026-10-29), unless it's answered already.
  const transactionId = searchParams.id ?? searchParams.paypal;
  const askLater =
    result === "approved" && transactionId && searchParams.registrationId
      ? await db.registration
          .findUnique({ where: { id: searchParams.registrationId }, select: { customFields: true } })
          .then((r) => !(r?.customFields as Record<string, unknown> | null)?.instagram)
      : false;

  const brandName = orgSettings.name;
  const eventName = event ? publicEventName(event) : "tu evento";
  const isVirtualOnly = event?.format === "VIRTUAL";

  const COPY: Record<ConfirmResult | "unknown", { title: string; body: string; tone: "ok" | "warn" | "bad" }> = {
    approved: {
      title: "¡Pago confirmado!",
      body: isVirtualOnly
        ? `Tu registro para ${eventName} quedó listo.`
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
      body: `Algo salió mal verificando la transacción. Si alcanzaste a pagar, escríbenos y lo confirmamos manualmente con ${searchParams.paypal ? "PayPal" : "Wompi"}.`,
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
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark, same as the homepage's own use of it */}
      <img src="/logo.png" alt={brandName} style={{ height: 64, width: "auto", margin: "0 auto 16px", display: "block" }} />
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
      <h1 className={fraunces.className} style={{ fontSize: 22, fontWeight: 900, margin: "0 0 10px" }}>
        {copy.title}
      </h1>
      <p style={{ fontSize: 14.5, color: "#5b5f6b", margin: "0 0 24px" }}>{copy.body}</p>

      {askLater && <PostPaymentQuestions registrationId={searchParams.registrationId!} transactionId={transactionId!} />}

      {result === "approved" && (
        <div
          style={{
            background: "#fff",
            border: "1.5px solid var(--accent)",
            borderRadius: 16,
            padding: "12px 14px",
            display: "flex",
            alignItems: "center",
            gap: 11,
            textAlign: "left",
            marginBottom: 24,
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
            <p style={{ fontSize: 12.5, fontWeight: 800, margin: 0 }}>{INSTAGRAM_HANDLE}</p>
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
      )}

      {event && copy.tone === "bad" && (
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
      )}
    </main>
  );
}
