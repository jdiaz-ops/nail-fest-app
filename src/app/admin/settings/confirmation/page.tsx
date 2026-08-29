import { getOrgSettings } from "@/lib/settings";
import ConfirmationTemplateEditor from "../../events/ConfirmationTemplateEditor";
import SaveConfirmationClient from "./SaveConfirmationClient";
import AttachPdfForm from "./AttachPdfForm";

export const dynamic = "force-dynamic";

// The GLOBAL confirmation email — applies to every event that doesn't
// set its own override (see /admin/events/[id]/confirmation). Ticket
// Tailor's own "Global confirmation" half of the same radio choice.
export default async function GlobalConfirmationSettingsPage() {
  const orgSettings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginBottom: 4 }}>Confirmación de correo</h2>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 20 }}>
        El correo que recibe cada persona al inscribirse — incluye su entrada. Cada evento puede tener el suyo
        propio en su propia página; esta es la plantilla que se usa cuando un evento no la reemplaza.
      </p>
      <SaveConfirmationClient initialHtml={orgSettings.confirmationEmailHtml} />
      <AttachPdfForm initialEnabled={orgSettings.attachTicketPdf} />
    </div>
  );
}
