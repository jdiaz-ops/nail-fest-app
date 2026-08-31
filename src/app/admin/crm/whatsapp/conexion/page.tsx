import { db } from "@/lib/db";
import { whatsappProvider } from "@/lib/whatsapp";
import WhatsAppConnectionForm from "@/components/WhatsAppConnectionForm";
import WhatsAppSubscribeAppButton from "@/components/WhatsAppSubscribeAppButton";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

// GREEN/YELLOW/RED — Meta's own quality-rating vocabulary, straight from
// the Graph API (see lib/whatsapp/meta.ts's getPhoneNumberStatus).
const QUALITY_STYLE: Record<string, { bg: string; ink: string; label: string }> = {
  GREEN: { bg: "#e3f4ec", ink: "#12966b", label: "Alta" },
  YELLOW: { bg: "#fdf1e6", ink: "#8a5a1f", label: "Media" },
  RED: { bg: "#fbe9ea", ink: "#a3212b", label: "Baja" },
};

export default async function WhatsAppConexionPage() {
  const connection = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" } });
  const baseUrl = process.env.APP_BASE_URL || "https://register.nailfest.co";
  const webhookUrl = `${baseUrl}/api/webhooks/whatsapp`;

  // Fetched live, never cached — see WhatsAppPhoneNumberStatus's own
  // comment. Best-effort: with no real Meta credentials yet, this fails
  // and the page just shows the connection exists without the extra
  // panel, rather than crashing the whole page over a status check.
  const status = connection ? await whatsappProvider.getPhoneNumberStatus().catch(() => null) : null;

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

      {connection && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24, maxWidth: 700 }}>
          <StatusCard label="Número verificado" value={status?.verifiedName || status?.displayPhoneNumber || "—"} />
          <StatusCard
            label="Calidad"
            value={status ? QUALITY_STYLE[status.qualityRating]?.label ?? status.qualityRating : "—"}
            pillStyle={status ? QUALITY_STYLE[status.qualityRating] : undefined}
          />
          <StatusCard label="Límite de mensajería" value={status?.messagingLimitTier ?? "—"} />
        </div>
      )}
      {connection && !status && (
        <p style={{ fontSize: 13, color: "#8a5a1f", marginTop: -16, marginBottom: 24 }}>
          No se pudo consultar el estado real del número en Meta ahora mismo (revisa que el token sea válido).
        </p>
      )}

      {connection && (
        <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 16, marginBottom: 24, maxWidth: 700 }}>
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 8px" }}>
            ¿La Bandeja no recibe mensajes reales aunque el webhook esté verificado?
          </p>
          <WhatsAppSubscribeAppButton />
        </div>
      )}

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

function StatusCard({ label, value, pillStyle }: { label: string; value: string; pillStyle?: { bg: string; ink: string } }) {
  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: "16px 20px", minWidth: 160 }}>
      <div style={{ fontSize: 12, color: "#5b5f6b", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {pillStyle ? (
        <span
          style={{
            display: "inline-flex",
            marginTop: 6,
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 600,
            background: pillStyle.bg,
            color: pillStyle.ink,
          }}
        >
          {value}
        </span>
      ) : (
        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value}</div>
      )}
    </div>
  );
}
