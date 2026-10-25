import type { Metadata } from "next";
import Link from "next/link";
import PortalShell from "@/components/portal/PortalShell";
import AccessLinkForm from "@/components/portal/AccessLinkForm";
import { findAccessLink } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu cuenta · Instructoras Nail Fest", robots: { index: false, follow: false }, referrer: "no-referrer" };

// nailfest.lat/instructoras/clave/<token> — a link the team sent her by
// WhatsApp (Editar biblioteca → Instructoras). Opening it changes nothing
// (WhatsApp's own preview opens it too); only the form spends it.
export default async function ClavePage({ params }: { params: { token: string } }) {
  const link = await findAccessLink(params.token);

  if (!link) {
    return (
      <PortalShell>
        <div className="pt-wrap">
          <h1 className={`pt-h1 ${fraunces.className}`}>Este enlace ya no sirve</h1>
          <p className="pt-lede">Ya se usó o venció (duran 7 días). Pídele al equipo de Nail Fest uno nuevo por WhatsApp.</p>
          <Link href="/instructoras/entrar" className="bib-btn bib-btn-line pt-wide">
            Ir a entrar
          </Link>
        </div>
      </PortalShell>
    );
  }

  const invite = !link.instructor.account;
  return (
    <PortalShell>
      <div className="pt-wrap">
        <h1 className={`pt-h1 ${fraunces.className}`}>{invite ? "Activa tu perfil" : "Crea una contraseña nueva"}</h1>
        {invite ? (
          <p className="pt-lede">
            El equipo de Nail Fest hizo tu perfil en el directorio de instructoras. Con tu cuenta lo manejas tú: tu foto, lo que cuentas de ti y tus redes.
            Tu usuario es <b>{link.instructor.slug}</b>.
          </p>
        ) : (
          <p className="pt-lede">
            Para tu cuenta <b>{link.instructor.slug}</b>. Al guardarla, se cierran las sesiones que tengas abiertas en otros celulares o computadores.
          </p>
        )}
        <AccessLinkForm token={params.token} invite={invite} />
      </div>
    </PortalShell>
  );
}
