import { getOrgSettings } from "@/lib/settings";
import AbandonedCartForm from "./AbandonedCartForm";

export const dynamic = "force-dynamic";

export default async function AbandonedCartPage() {
  const settings = await getOrgSettings();
  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Carrito abandonado</h2>
      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 640 }}>
        Cuando alguien empieza a registrarse a un evento pero no termina, le mandamos hasta dos correos de
        recordatorio (a los 15 minutos y a las 2 horas). Apagar esto pausa los dos envíos de inmediato — incluso
        los que ya estaban programados para alguien que empezó a llenar el formulario antes de que apagaras el
        interruptor.
      </p>
      <AbandonedCartForm initialEnabled={settings.abandonedCartEmailsEnabled} />
    </div>
  );
}
