import { getOrgSettings } from "@/lib/settings";
import BasicSettingsForm from "./BasicSettingsForm";

export const dynamic = "force-dynamic";

export default async function BasicSettingsPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Datos básicos</h2>
      <BasicSettingsForm
        initialName={settings.name}
        initialTimezone={settings.timezone}
        initialLanguage={settings.language}
      />
    </div>
  );
}
