import { getOrgSettings } from "@/lib/settings";
import ContactPreferencesForm from "./ContactPreferencesForm";

export const dynamic = "force-dynamic";

export default async function ContactPreferencesPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Contacto</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        A dónde deben llegar las respuestas cuando alguien responde al correo de confirmación de
        su entrada.
      </p>
      <ContactPreferencesForm initialReplyToEmail={settings.replyToEmail ?? ""} />
    </div>
  );
}
