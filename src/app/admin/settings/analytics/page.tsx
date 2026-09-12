import { getOrgSettings } from "@/lib/settings";
import ClaritySettingsForm from "./ClaritySettingsForm";

export const dynamic = "force-dynamic";

export default async function AnalyticsSettingsPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Analítica</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Heatmaps y grabaciones de sesión de la página del evento — para ver en qué se detiene la
        gente antes de registrarse (y en qué no), no solo si se registró o no.
      </p>
      <ClaritySettingsForm initialClarityProjectId={settings.clarityProjectId ?? ""} />
    </div>
  );
}
