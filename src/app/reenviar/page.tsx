import { getOrgSettings } from "@/lib/settings";
import ResendTicketForm from "./ResendTicketForm";

export const dynamic = "force-dynamic";

export default async function ResendTicketPage() {
  const settings = await getOrgSettings();

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 22 }}>Reenviar mi entrada</h1>
      {settings.selfServeResendEnabled ? (
        <>
          <p style={{ color: "#5b5f6b" }}>
            Escribe el correo con el que te registraste — si tienes una entrada activa, te la
            reenviamos.
          </p>
          <ResendTicketForm />
        </>
      ) : (
        <p style={{ color: "#5b5f6b" }}>Esta función no está disponible por ahora.</p>
      )}
    </main>
  );
}
