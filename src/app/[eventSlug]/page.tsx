import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { getOrderedProfessionOptions } from "@/lib/professions";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { getCheckoutQuestions } from "@/lib/checkoutForm";
import RegistrationForm, { type QuestionView } from "@/components/RegistrationForm";
import MetaPixelScript from "@/components/MetaPixelScript";

export const dynamic = "force-dynamic";

export default async function EventLandingPage({ params }: { params: { eventSlug: string } }) {
  const event = await db.event.findUnique({ where: { slug: params.eventSlug } });
  if (!event) notFound();

  const [professionOptions, metaConnection, orgSettings, checkoutQuestions] = await Promise.all([
    getOrderedProfessionOptions(),
    db.metaConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { pixelId: true } }),
    getOrgSettings(),
    getCheckoutQuestions(),
  ]);
  const questions: QuestionView[] = checkoutQuestions.map((q) => ({
    key: q.key,
    label: q.label,
    type: q.type,
    required: q.required,
    options: q.options,
    locked: q.locked,
    nameFormat: q.nameFormat,
    confirmEmail: q.confirmEmail,
  }));

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "40px 20px" }}>
      <MetaPixelScript pixelId={metaConnection?.pixelId ?? null} />

      <p style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 12, color: "#5b5f6b" }}>
        {orgSettings.name} · {event.city}
      </p>
      <h1 style={{ marginTop: 4 }}>{event.name}</h1>
      <p>
        {formatDateInTz(
          event.startsAt,
          { dateStyle: "full", timeStyle: "short" },
          orgSettings.timezone,
          orgSettings.language
        )}
      </p>
      <p>Entrada gratuita. Cupo limitado{event.capacity ? ` a ${event.capacity} personas` : ""}.</p>

      <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "24px 0" }} />

      <Suspense>
        <RegistrationForm eventSlug={event.slug} professionOptions={professionOptions} questions={questions} />
      </Suspense>

      {orgSettings.selfServeResendEnabled && (
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 24, textAlign: "center" }}>
          ¿Ya te registraste y perdiste el correo? <a href="/reenviar">Reenviar mi entrada</a>
        </p>
      )}
    </main>
  );
}
