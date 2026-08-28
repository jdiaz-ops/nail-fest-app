import { cardStyle } from "../shared";

// Mirrors Ticket Tailor's "Checkout form" — their version is a live form
// builder (add/edit/reorder/delete questions from the UI); ours isn't yet,
// these fields are still hardcoded in RegistrationForm.tsx. Listing them
// here — read-only, no pencil/trash icons that would do nothing if
// clicked — keeps this honest about what's actually editable today while
// still giving a complete picture of what the checkout form collects.

const BUYER_QUESTIONS: { label: string; required: boolean }[] = [
  { label: "Nombre y Apellido - o - Razón Social", required: true },
  { label: "Correo Electrónico (verificado: ahí se envía la entrada)", required: true },
  { label: "Número de celular con WhatsApp", required: true },
  { label: "Número de cédula - o - NIT", required: true },
  { label: "¿En qué ciudad vives?", required: true },
  { label: "¿Cuál de estas opciones te describe mejor?", required: true },
  { label: "@ Instagram/TikTok", required: false },
];

const CONSENTS: { label: string; required: boolean }[] = [
  { label: "Autorizo el tratamiento de mis datos para enviarme mi entrada (LOGISTICS)", required: true },
  { label: "Quiero recibir novedades por correo (MARKETING)", required: false },
  { label: "Autorizo compartir mis datos con Meta (ADVERTISING)", required: false },
];

export default function CheckoutFormPage() {
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Checkout form</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Las preguntas que se le hacen a cualquiera que se registre a un evento. Hoy están fijas en
        el código (<code>RegistrationForm.tsx</code>) — esta pantalla es de solo lectura por
        ahora, todavía no es un editor como el de Ticket Tailor.
      </p>

      <div style={{ ...cardStyle, maxWidth: 700 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Buyer questions</div>
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>Se preguntan una vez por registro.</p>
        {BUYER_QUESTIONS.map((q) => (
          <div
            key={q.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid #f0efec",
              fontSize: 14,
            }}
          >
            <span>{q.label}</span>
            {q.required ? (
              <span style={{ color: "#c2185b" }}>*</span>
            ) : (
              <span style={{ fontSize: 12, color: "#8a8478" }}>Opcional</span>
            )}
          </div>
        ))}

        <div style={{ fontWeight: 600, marginTop: 24, marginBottom: 4 }}>Consentimientos</div>
        <p style={{ fontSize: 12, color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>
          Separados por propósito, no un solo checkbox — ver <code>lib/consent.ts</code>.
        </p>
        {CONSENTS.map((c) => (
          <div
            key={c.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: "1px solid #f0efec",
              fontSize: 14,
            }}
          >
            <span>{c.label}</span>
            {c.required ? (
              <span style={{ color: "#c2185b" }}>*</span>
            ) : (
              <span style={{ fontSize: 12, color: "#8a8478" }}>Opcional</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
