import { getOrgSettings } from "@/lib/settings";
import TermsAndConditionsForm from "./TermsAndConditionsForm";

export const dynamic = "force-dynamic";

export default async function TermsAndConditionsPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Términos y condiciones</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Se publica en <code>/terminos</code>, enlazada junto con la política de privacidad desde el pie del
        formulario de registro — su aceptación va implícita al enviar el formulario, sin checkbox propio.
      </p>
      <TermsAndConditionsForm initialText={settings.termsAndConditionsText ?? ""} />
    </div>
  );
}
