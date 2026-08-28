import { getOrgSettings } from "@/lib/settings";
import CookieConsentForm from "./CookieConsentForm";

export const dynamic = "force-dynamic";

export default async function CookieConsentPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Cookie consent</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Muestra un aviso de cookies en todo el sitio. Es aparte del checkbox de &quot;Autorizo
        compartir mis datos con Meta&quot; del formulario — ese cubre el envío a Meta
        específicamente y ya está activo; esto es el aviso general de que el sitio usa cookies.
      </p>
      <CookieConsentForm initialEnabled={settings.cookieConsentEnabled} />
    </div>
  );
}
