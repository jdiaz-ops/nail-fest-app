import { db } from "@/lib/db";
import MetaConnectionForm from "@/components/MetaConnectionForm";
import MetaAudiencesButton from "@/components/MetaAudiencesButton";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const metaConnection = await db.metaConnection.findFirst({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h2 style={{ fontSize: 18, marginTop: 0 }}>Integraciones</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900, marginBottom: 32 }}>
        <IntegrationRow name="Meta (Facebook/Instagram Ads)" connected={Boolean(metaConnection)} />
        <IntegrationRow name="TikTok Ads" comingSoon />
        <IntegrationRow name="Google Analytics" comingSoon />
      </div>

      <div style={{ maxWidth: 900 }}>
        <h3 style={{ fontSize: 16 }}>Conectar Meta</h3>
        <p style={{ color: "#5b5f6b" }}>
          Esto conecta tu Business Manager una sola vez. No es login — es un token de un &quot;System
          User&quot; que no expira solo, así que no hay que repetir esto cada 60 días.
        </p>

        <ol style={{ lineHeight: 1.9, paddingLeft: 20 }}>
          <li>
            En Meta Business Settings → <strong>Users → System Users</strong> → Add. Nómbralo como
            quieras (ej. <code>nail-fest-app</code>), rol <strong>Admin</strong>.
          </li>
          <li>
            En ese System User → <strong>Assign Assets</strong> → dale acceso a tu Ad Account y a
            tu Pixel.
          </li>
          <li>
            En la misma pantalla del System User → <strong>Generate New Token</strong> → elige tu
            app (si no tienes una, créala en Business Settings → Accounts → Apps) → marca los
            permisos <code>ads_management</code> y <code>business_management</code> → Generate.
            Copia el token — Meta solo lo muestra una vez.
          </li>
          <li>
            Tu <strong>Pixel ID</strong> está en Events Manager → Data Sources. Tu{" "}
            <strong>Ad Account ID</strong> está en Business Settings → Ad Accounts (empieza con{" "}
            <code>act_</code>).
          </li>
          <li>Pega los tres valores abajo y guarda.</li>
        </ol>

        <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "24px 0" }} />

        <MetaConnectionForm />

        <p style={{ color: "#5b5f6b", fontSize: 13, marginTop: 32 }}>
          Después de guardar: en Events Manager → tu Pixel → Test Events, copia el código de
          prueba y agrégalo como <code>META_TEST_EVENT_CODE</code> en las variables de entorno de
          Vercel — así puedes ver los eventos llegar en vivo antes de confiar en ellos con tráfico
          real.
        </p>

        <hr style={{ border: "none", borderTop: "1px solid #e3e1dc", margin: "32px 0 24px" }} />

        <h3 style={{ fontSize: 16 }}>Audiencias semilla</h3>
        <p style={{ color: "#5b5f6b", fontSize: 14 }}>
          <strong>Landing visitors (180d)</strong>, <strong>Checkout started (180d)</strong> y{" "}
          <strong>Purchasers (180d)</strong> se mantienen solas — un cron
          (<code>/api/meta/sync-audiences</code>, ver <code>docs/DEPLOY.md</code>) las
          crea/actualiza y resincroniza Purchasers automáticamente. El botón de abajo solo sirve
          para forzar una corrida ahora mismo (ej. para probar sin esperar al cron); no hace falta
          usarlo en el día a día.
        </p>
        <MetaAudiencesButton />

        <p style={{ color: "#5b5f6b", fontSize: 13, marginTop: 32 }}>
          ¿Quieres una audiencia para un evento o filtro específico (ej. &quot;solo Pereira
          2026&quot;)? Eso se arma en <a href="/admin/crm/segments">Segmentos</a> — también se
          sincroniza sola, sin botón.
        </p>
      </div>
    </div>
  );
}

function IntegrationRow({ name, connected, comingSoon }: { name: string; connected?: boolean; comingSoon?: boolean }) {
  const label = comingSoon ? "Próximamente" : connected ? "Conectado" : "No conectado";
  const color = comingSoon ? "#8a8478" : connected ? "#12966b" : "#b8791a";
  const bg = comingSoon ? "#f0efec" : connected ? "#e3f4ec" : "#fbeee0";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid #e3e1dc",
        borderRadius: 10,
        padding: "12px 16px",
        opacity: comingSoon ? 0.7 : 1,
      }}
    >
      <span style={{ fontWeight: 500 }}>{name}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color, background: bg, padding: "4px 10px", borderRadius: 999 }}>
        {label}
      </span>
    </div>
  );
}
