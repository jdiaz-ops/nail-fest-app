import { db } from "@/lib/db";
import WhatsAppConnectionForm from "@/components/WhatsAppConnectionForm";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

export default async function WhatsAppConexionPage() {
  const connection = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" } });
  const baseUrl = process.env.APP_BASE_URL || "https://register.nailfest.co";
  const webhookUrl = `${baseUrl}/api/webhooks/whatsapp`;

  return (
    <div>
      <CrmPageHeader
        title="WhatsApp — Conexión"
        subtitle="Conexión directa contra la Cloud API de Meta — sin WhatChimp ni ningún otro intermediario. Ver docs/WHATSAPP_SETUP.md para el paso a paso completo."
      />

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          fontWeight: 600,
          padding: "4px 12px",
          borderRadius: 999,
          marginBottom: 24,
          background: connection ? "#e3f4ec" : "#fbeee0",
          color: connection ? "#12966b" : "#b8791a",
        }}
      >
        {connection ? `Conectado${connection.displayPhoneNumber ? ` — ${connection.displayPhoneNumber}` : ""}` : "No conectado"}
      </div>

      <div style={{ maxWidth: 700 }}>
        <ol style={{ lineHeight: 1.9, paddingLeft: 20, color: "#3d3a35" }}>
          <li>
            En <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">Meta App Dashboard</a> → tu app →{" "}
            <strong>WhatsApp → API Setup</strong>: copia el <strong>Phone number ID</strong> y el{" "}
            <strong>WhatsApp Business Account ID</strong>.
          </li>
          <li>
            Genera un token <strong>permanente</strong> (no el temporal de 24h que aparece por defecto): Business Settings →{" "}
            <strong>Users → System Users</strong> → tu System User (o crea uno) → Add Assets → asígnale la WABA de arriba
            con permiso de gestión → <strong>Generate New Token</strong>, marcando{" "}
            <code>whatsapp_business_messaging</code> y <code>whatsapp_business_management</code>.
          </li>
          <li>
            En <strong>WhatsApp → Configuration → Webhook</strong>: pega la URL de abajo y el mismo verify token que vas a
            guardar aquí, y suscríbete a los campos <code>messages</code> (para recibir mensajes) — sin esto, la Bandeja
            nunca recibe nada.
          </li>
          <li>Pega los valores abajo y guarda.</li>
        </ol>

        <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "24px 0" }} />

        <WhatsAppConnectionForm webhookUrl={webhookUrl} />
      </div>
    </div>
  );
}
