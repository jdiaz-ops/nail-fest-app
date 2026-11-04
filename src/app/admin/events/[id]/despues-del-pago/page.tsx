import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { savedConfirmationMode } from "@/lib/confirmationSample";
import { asistireSampleUrl, kitUrl, marcoUrl } from "@/lib/imparables/asistire";
import { KIT } from "@/lib/imparables/kit";
import { congresoSamplePath, congresoSampleToken, diplomaPath } from "@/lib/imparables/miCongreso";
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
// try with any photo, her kit's page, her profile frame, her recordings page,
// her diploma and the closing email with its WhatsApp (2026-11-04).
// Each tab is the real page in the team's preview (?vista= on /pago, the
// sample links): sample data, nothing saved or sent to anyone. ADMIN-only,
// like the rest of Configuración.
// The closing's WhatsApp (the team, 2026-11-04): a template to create in Meta — its text, with her name, the last day of
// the recordings and her review link, and two buttons that open her recordings and her diploma with her own key. It's
// sent once Meta approves it; until then this is its draft, to copy.
const CLOSING_TEMPLATE = {
  name: "imparables_cierre",
  body: "¡Hola, {{1}}! Gracias por ser parte de Manicuristas Imparables.\n\nYa puedes ver la grabación de cada charla hasta el {{2}} y descargar tu diploma con tu nombre.\n\n¿Cómo te fue? Déjanos tu reseña aquí: {{3}}",
  variables: ["{{1}}: su nombre", "{{2}}: el último día de las grabaciones («martes 3 de agosto»)", "{{3}}: su enlace de reseña"],
  buttons: [
    { label: "Ver mis grabaciones", url: "https://nailfest.lat/mi-congreso/{{1}}" },
    { label: "Descargar mi diploma", url: "https://nailfest.lat/api/diploma/{{1}}" },
  ],
};

function ClosingWhatsApp() {
  const box = { margin: 0, padding: "12px 14px", border: "1px solid #e3e1dc", borderRadius: 10, background: "#faf9f7", fontSize: 13.5, lineHeight: 1.5, whiteSpace: "pre-wrap" as const };
  return (
    <section style={{ marginTop: 24, maxWidth: 660 }}>
      <h3 style={{ fontSize: 16, margin: "0 0 4px" }}>WhatsApp de cierre</h3>
      <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 12px" }}>
        Es una plantilla que hay que crear en Meta (WhatsApp Manager → Plantillas) y esperar a que la aprueben. Este es su borrador para copiar. Se envía
        cuando esté aprobada; no se le envía nada a nadie todavía.
      </p>
      <p style={{ fontSize: 13, margin: "0 0 4px" }}>
        <strong>Nombre:</strong> {CLOSING_TEMPLATE.name} · <strong>Idioma:</strong> español · <strong>Categoría:</strong> Utilidad (Meta puede cambiarla)
      </p>
      <p style={{ fontSize: 13, fontWeight: 700, margin: "12px 0 4px" }}>Texto</p>
      <pre style={box}>{CLOSING_TEMPLATE.body}</pre>
      <ul style={{ fontSize: 13, color: "#5b5f6b", margin: "8px 0 0", paddingLeft: 18 }}>
        {CLOSING_TEMPLATE.variables.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
      <p style={{ fontSize: 13, fontWeight: 700, margin: "12px 0 4px" }}>Botones (tipo «Visitar sitio web», URL dinámica)</p>
      <ul style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
        {CLOSING_TEMPLATE.buttons.map((b) => (
          <li key={b.label}>
            <strong>{b.label}</strong>: {b.url}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 0" }}>En cada botón, el {"{{1}}"} se llena con la clave personal de cada compradora.</p>
    </section>
  );
}

export default async function AfterPaymentPage({ params, searchParams }: { params: { id: string }; searchParams: { vista?: string } }) {
  await requirePageUser(["ADMIN"]);
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { id: params.id } }), getOrgSettings()]);
  if (!event) notFound();
  // The real confirmation attaches the ticket's PDF only for an event at a place, with that option on (sendTicketEmail).
  const sendsPdf = orgSettings.attachTicketPdf && event.format !== "VIRTUAL";

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
          {
            id: "kit",
            label: "Tu kit Imparable",
            src: kitUrl(asistireSampleUrl(event.id)),
            note: "La página de su kit, con un enlace solo suyo: su foto de perfil con el marco, los fondos de pantalla y las plantillas de historias.",
          },
          {
            id: "marco",
            label: "Foto de perfil",
            src: marcoUrl(asistireSampleUrl(event.id)),
            note: "Parte de su kit: se abre desde el correo de confirmación, en «Tu kit Imparable». Pruébala con cualquier foto: no se guarda nada.",
          },
          {
            id: "grabaciones",
            label: "Grabaciones",
            src: congresoSamplePath(event.id),
            note: "Su página de grabaciones, con un enlace solo suyo: la grabación de cada charla, desde que termina el congreso. Todavía no se le envía a nadie.",
          },
          {
            id: "diploma",
            label: "Diploma",
            src: diplomaPath(congresoSampleToken(event.id)),
            note: "Con un enlace propio para los correos: se descarga al terminar el congreso, con su nombre como lo escribió al comprar.",
          },
          {
            id: "resena",
            label: "Reseña",
            src: `/resena/${congresoSampleToken(event.id)}`,
            note: "Se abre desde el correo de cierre, al terminar el congreso: la puede dejar toda compradora con su pago confirmado. Aquí no se envía nada.",
          },
          {
            id: "cierre",
            label: "Correo de cierre",
            src: `/api/admin/events/${event.id}/cierre/preview`,
            note: "Después del congreso, cuando las grabaciones estén subidas: sus grabaciones, su diploma y su reseña, cada enlace suyo. Todavía no se le envía a nadie.",
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
        {active.id === "grabaciones" && (
          <>
            {" · "}
            <Link href={`/admin/events/${event.id}/grabaciones`}>Pegar los enlaces de las grabaciones</Link>
          </>
        )}
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
            note={`Con datos de ejemplo y «[Prueba]» al comienzo del asunto.${sendsPdf ? " Lleva la entrada en PDF, de muestra, como el real." : ""}`}
          />
          <iframe
            src={active.src}
            title="Correo de confirmación"
            style={{ display: "block", width: "100%", maxWidth: 660, height: 1100, marginTop: 16, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}
          />
        </>
      ) : active.id === "cierre" ? (
        <>
          <TestSendBox url={`/api/admin/events/${event.id}/cierre/test`} body={{}} note="Con datos de ejemplo y «[Prueba]» al comienzo del asunto." />
          <iframe
            src={active.src}
            title="Correo de cierre"
            style={{ display: "block", width: "100%", maxWidth: 660, height: 1100, marginTop: 16, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}
          />
          <ClosingWhatsApp />
        </>
      ) : active.id === "diploma" ? (
        // The PDF itself where the browser shows PDFs; where it doesn't (a phone), its picture and the link.
        <object
          data={active.src}
          type="application/pdf"
          aria-label="Diploma de muestra"
          style={{ display: "block", width: "100%", maxWidth: 980, height: 720, border: "1px solid #e3e1dc", borderRadius: 12, background: "#fff" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- the kit's fixed picture of the diploma */}
          <img src={KIT.diplomaPreview} alt="Diploma de muestra, a nombre de Ana María Rodríguez" style={{ display: "block", width: "100%", height: "auto", borderRadius: 12 }} />
        </object>
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
