import { getOrgSettings } from "@/lib/settings";
import PrivacyPolicyForm from "./PrivacyPolicyForm";

export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Privacy policy</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Se publica en <code>/privacidad</code>, enlazada desde el pie del formulario de registro.
      </p>
      <PrivacyPolicyForm initialText={settings.privacyPolicyText ?? ""} />
    </div>
  );
}
