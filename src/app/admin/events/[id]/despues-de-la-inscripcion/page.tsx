import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { savedConfirmationMode } from "@/lib/confirmationSample";
import { asistireSampleUrl } from "@/lib/imparables/asistire";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";
import { NAIL_FEST_DESIGN } from "@/lib/nailfest/confirmation";
import TestSendBox from "../../TestSendBox";
import SignupScreenSwitch from "./SignupScreenSwitch";

export const dynamic = "force-dynamic";

// «Después de la inscripción» (2026-10-30): what someone sees once she signs
// up to a Nail Fest event at a place, the way she sees it, in tabs — the
// screen right after signing up (Nail Fest's own, switched on here; the
// event's page in the team's preview, ?vista=inscrita), her confirmation
// email (and a test of it to the team's inbox), and the «Asistiré» image to
// try with any photo. Sample data: nothing saved or sent to anyone. Like
// «Después del pago» for Manicuristas Imparables. ADMIN-only.
export default async function AfterSignupPage({ params, searchParams }: { params: { id: string }; searchParams: { vista?: string } }) {
  await requirePageUser(["ADMIN"]);
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { id: params.id } }), getOrgSettings()]);
  if (!event || !hasNailFestAsistire(event)) notFound();
  const sendsPdf = orgSettings.attachTicketPdf;

  const mode = savedConfirmationMode(event);
  const sentNow = { design: "el diseño Nail Fest presencial", event: "la confirmación específica del evento", global: "la confirmación global" }[mode];
  const designed = event.confirmationEmailDesign === NAIL_FEST_DESIGN;
  const tabs: { id: string; label: string; src: string; note: string }[] = [
    {
      id: "inscrita",
      label: "Inscripción confirmada",
      src: `/${event.slug}?vista=inscrita`,
      note: "Lo que ve apenas termina de inscribirse: su entrada con el código QR, para tomarle captura.",
    },
    {
      id: "correo",
      label: "Correo de confirmación",
      src: `/api/admin/events/${event.id}/confirmation/preview?modo=${mode}`,
      note: "Le llega apenas se inscribe, con su entrada.",
    },
    {
      id: "imagen",
      label: "Imagen «Asistiré»",
      src: asistireSampleUrl(event.id),
      note: "Se abre desde la pantalla de inscripción confirmada y desde el correo. Pruébala con cualquier foto: no se guarda nada.",
    },
  ];
  const active = tabs.find((t) => t.id === searchParams.vista) ?? tabs[0]!;

  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Después de la inscripción</h2>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 0 }}>
        Lo que ve cada persona cuando se inscribe, tal como lo ve. Con datos de ejemplo: no se guarda ni se envía nada a nadie.
      </p>

      <nav role="tablist" style={{ display: "flex", gap: 4, margin: "16px 0", borderBottom: "1px solid #e3e1dc", overflowX: "auto" }}>
        {tabs.map((t) => {
          const on = t.id === active.id;
          return (
            <Link
              key={t.id}
              href={`/admin/events/${event.id}/despues-de-la-inscripcion?vista=${t.id}`}
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

      {active.id === "inscrita" && <SignupScreenSwitch eventId={event.id} on={event.signupScreenDesign === NAIL_FEST_DESIGN} />}

      {active.id === "imagen" && !designed && (
        <p style={{ fontSize: 13, margin: "0 0 12px", maxWidth: 660 }}>
          El enlace a la imagen va en la pantalla de inscripción confirmada y en el correo con el <strong>diseño Nail Fest presencial</strong> (se elige en{" "}
          <Link href={`/admin/events/${event.id}/confirmation`}>Confirmación del evento</Link>).
        </p>
      )}

      {active.id === "correo" ? (
        <>
          <p style={{ fontSize: 13, margin: "0 0 4px" }}>
            Hoy se envía <strong>{sentNow}</strong>. Se cambia en <Link href={`/admin/events/${event.id}/confirmation`}>Confirmación del evento</Link>
            {designed ? "." : ", donde también está el diseño Nail Fest presencial."}
          </p>
          <TestSendBox
            url={`/api/admin/events/${event.id}/confirmation/test`}
            body={{ mode }}
            note={`Con datos de ejemplo y «[Prueba]» al comienzo del asunto.${sendsPdf ? " Sin la entrada en PDF que lleva el correo real." : ""}`}
          />
          <iframe
            src={active.src}
            title="Correo de confirmación"
            style={{ display: "block", width: "100%", maxWidth: 660, height: 1100, marginTop: 16, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}
          />
        </>
      ) : (
        // A phone's screen: most people sign up on one.
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
