import { getOrgSettings } from "@/lib/settings";
import BannedEmailsForm from "./BannedEmailsForm";

export const dynamic = "force-dynamic";

export default async function BannedEmailsPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Correos bloqueados</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Estos correos no pueden completar el formulario de registro para ningún evento.
      </p>
      <BannedEmailsForm initialEmails={settings.bannedEmails} />
    </div>
  );
}
