import MetaConnectionForm from "@/components/MetaConnectionForm";
import MetaAudiencesButton from "@/components/MetaAudiencesButton";

export default function MetaSetupPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1>Conectar Meta</h1>
      <p style={{ color: "#5b5f6b" }}>
        Esto conecta tu Business Manager una sola vez. No es login — es un token de un
        &quot;System User&quot; que no expira solo, así que no hay que repetir esto cada 60 días.
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

      <h2 style={{ fontSize: 18 }}>Audiencias semilla</h2>
      <p style={{ color: "#5b5f6b", fontSize: 14 }}>
        Crea las tres audiencias base — <strong>Landing visitors (180d)</strong>,{" "}
        <strong>Checkout started (180d)</strong> y <strong>Purchasers (180d)</strong>. Solo hace
        falta correrlo una vez (es seguro darle click varias veces, no duplica nada).
      </p>
      <MetaAudiencesButton />
    </div>
  );
}
