import { getOrgSettings } from "@/lib/settings";
import SelfServeForm from "./SelfServeForm";

export const dynamic = "force-dynamic";

export default async function SelfServePage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Autoservicio</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Activa <code>/reenviar</code> — una página pública donde alguien que perdió su correo de
        confirmación pone su email y le reenviamos su(s) entrada(s), sin llenar el formulario de
        nuevo. No cubre reembolsos ni reprogramar (nuestros eventos no cobran, así que no aplica).
      </p>
      <SelfServeForm initialEnabled={settings.selfServeResendEnabled} />
    </div>
  );
}
