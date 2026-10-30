import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { savedConfirmationMode } from "@/lib/confirmationSample";
import { asistireSampleUrl } from "@/lib/imparables/asistire";
import TestSendBox from "../../TestSendBox";

export const dynamic = "force-dynamic";

const SENT_NOW = {
  design: "el diseño del congreso",
  event: "la confirmación específica del evento",
  global: "la confirmación global",
} as const;

// «Después del pago» (2026-10-30): what someone sees once she has paid, the
// way she sees it, in tabs — the payment's page (and its answers while PSE
// confirms, or when the bank says no), her confirmation email (and a test of
// it to the team's inbox), and Manicuristas Imparables' «Asistiré» image to
// try with any photo. Each tab is the real page in the team's preview
// (?vista= on /pago, the image's sample link): sample data, nothing saved or
// sent to anyone. ADMIN-only, like the rest of Configuración.
export default async function AfterPaymentPage({ params, searchParams }: { params: { id: string }; searchParams: { vista?: string } }) {
  await requirePageUser(["ADMIN"]);
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event) notFound();

  const mode = savedConfirmationMode(event);
  const tabs: { id: string; label: string; src: string; note: string }[] = [
    { id: "pago", label: "Pago confirmado", src: `/${event.slug}/pago?vista=aprobado`, note: "Lo primero que ve al terminar de pagar, con Wompi o con PayPal." },
    {
      id: "correo",
      label: "Correo de confirmación",
      src: `/api/admin/events/${event.id}/confirmation/preview?modo=${mode}`,
      note: "Le llega apenas se confirma el pago, con su entrada.",
    },
    ...(event.theme === "IMPARABLES"
      ? [
          {
            id: "imagen",
            label: "Imagen «Asistiré»",
            src: asistireSampleUrl(event.id),
            note: "Se abre desde la página de pago y desde el correo. Pruébala con cualquier foto: no se guarda nada.",
          },
        ]
      : []),
    { id: "pendiente", label: "Pago en proceso", src: `/${event.slug}/pago?vista=pendiente`, note: "Si paga con PSE u otro medio que tarda unos minutos en confirmarse." },
    { id: "rechazado", label: "Pago rechazado", src: `/${event.slug}/pago?vista=rechazado`, note: "Si su banco o el medio de pago rechaza la transacción." },
  ];
  const active = tabs.find((t) => t.id === searchParams.vista) ?? tabs[0]!;

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Después del pago</h2>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 0 }}>
        Lo que ve cada persona cuando termina de pagar, tal como lo ve. Con datos de ejemplo: no se guarda ni se envía nada a nadie.
      </p>

      <nav role="tablist" style={{ display: "flex", gap: 4, margin: "16px 0", borderBottom: "1px solid #e3e1dc", overflowX: "auto" }}>
        {tabs.map((t) => {
          const on = t.id === active.id;
          return (
            <Link
              key={t.id}
              href={`/admin/events/${event.id}/despues-del-pago?vista=${t.id}`}
              role="tab"
              aria-selected={on}
              style={{
                flexShrink: 0,
                padding: "10px 16px",
                borderBottom: `2px solid ${on ? "#12966b" : "transparent"}`,
                marginBottom: -1,
                fontSize: 14,
                fontWeight: on ? 700 : 500,
                color: on ? "#0b2e2c" : "#5b5f6b",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 12px" }}>
        {active.note}{" "}
        <a href={active.src} target="_blank" rel="noreferrer">
          Abrir en otra pestaña ↗
        </a>
      </p>

      {active.id === "correo" ? (
        <>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Hoy se envía <strong>{SENT_NOW[mode]}</strong>. Se cambia en{" "}
            <Link href={`/admin/events/${event.id}/confirmation`}>Confirmación del evento</Link>.
          </p>
          <TestSendBox
            url={`/api/admin/events/${event.id}/confirmation/test`}
            body={{ mode }}
            note="Con datos de ejemplo y «[Prueba]» al comienzo del asunto. Sin la entrada en PDF."
          />
          <iframe
            src={active.src}
            title="Correo de confirmación"
            style={{ display: "block", width: "100%", maxWidth: 660, height: 1100, marginTop: 16, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}
          />
        </>
      ) : (
        // A phone's screen: most buyers pay on one.
        <div style={{ width: 410, maxWidth: "100%", padding: 10, borderRadius: 48, background: "#141414", boxShadow: "0 18px 40px rgba(0,0,0,0.18)" }}>
          <iframe
            key={active.id}
            src={active.src}
            title={active.label}
            style={{ display: "block", width: "100%", height: 844, border: 0, borderRadius: 38, background: "#fff" }}
          />
        </div>
      )}
    </div>
  );
}
