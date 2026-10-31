import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { fetchTransaction } from "@/lib/payments/wompi";
import { confirmRegistrationPayment } from "@/lib/payments/confirmRegistrationPayment";
import { pesos } from "@/lib/imparables/stages";
import { UPGRADE_PAGE, fill } from "@/lib/imparables/tiers";
import { upgradeRegistrationId, upgradeState } from "@/lib/imparables/tiersServer";
import { Tiara } from "@/components/imparables/ImpArt";
import { TierCard } from "@/components/imparables/ImpTiers";
import ImpUpgrade from "@/components/imparables/ImpUpgrade";
import { cinzel, manrope } from "@/components/imparables/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mejora tu boleta · Manicuristas Imparables", robots: { index: false, follow: false } };

// Her page to move up a ticket level (lib/imparables/tiers.ts, 2026-10-31):
// nailfest.lat/mejorar/<her registration, signed> — from her confirmation's
// «Ver cómo». Her level, and each one above it with what it brings besides
// and what it costs her: the difference with what she paid, in pesos through
// Wompi. Back from Wompi (?id=), the payment is confirmed here, as /pago does.
export default async function MejorarPage({ params, searchParams }: { params: { token: string }; searchParams: { id?: string } }) {
  const registrationId = upgradeRegistrationId(params.token);
  if (!registrationId) notFound();
  let paid: "approved" | "other" | null = null;
  if (searchParams.id) {
    // Read from Wompi's API here on the server, never on the link's own word (lib/payments/confirmRegistrationPayment.ts).
    const transaction = await fetchTransaction(searchParams.id);
    const result = transaction ? await confirmRegistrationPayment(transaction) : "error";
    paid = result === "approved" ? "approved" : "other";
  }
  const state = await upgradeState(registrationId);
  if (!state) notFound();
  const person = await db.registration.findUnique({ where: { id: registrationId }, select: { person: { select: { email: true } } } });

  return (
    <main className={`imp ${cinzel.variable} ${manrope.variable}`}>
      <section className="imp-sec imp-up">
        <div className="imp-sec-in">
          <Tiara />
          <h1 className="imp-h2">{UPGRADE_PAGE.title}</h1>
          {paid === "approved" && <p className="imp-up-msg">Listo: tu pago quedó aprobado. Te escribimos a tu correo.</p>}
          {paid === "other" && <p className="imp-up-msg">Tu pago no quedó aprobado. Puedes intentarlo de nuevo.</p>}
          <p className="imp-up-now">
            {state.firstName ? `Hola, ${state.firstName}: ` : ""}tienes <b>{state.current.name}</b>.
          </p>
          {state.options.length === 0 ? (
            <p className="imp-up-now">{UPGRADE_PAGE.top}</p>
          ) : state.paidPesos === null || state.ticketCount > 1 ? (
            <p className="imp-up-msg">{state.paidPesos === null ? UPGRADE_PAGE.usd : UPGRADE_PAGE.tickets}</p>
          ) : (
            <div className="imp-lv-cards">
              {state.options.map(({ tier, difference, available }) => (
                <TierCard
                  key={tier.slug}
                  tier={tier}
                  badge={available ? null : UPGRADE_PAGE.eliteSoldOut}
                  price={pesos(tier.fixedPrice ?? 0)}
                  note={<>{fill(UPGRADE_PAGE.pay, { diferencia: "" })}<b>{pesos(difference)}</b></>}
                  top={tier.slug === "circulo"}
                  out={!available}
                >
                  {available && difference > 0 && (
                    <ImpUpgrade token={params.token} tier={tier.slug} label={fill(UPGRADE_PAGE.button, { nivel: tier.name.replace(/^Imparable /, "") })} email={person?.person.email ?? ""} />
                  )}
                </TierCard>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
