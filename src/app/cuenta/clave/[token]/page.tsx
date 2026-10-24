import type { Metadata } from "next";
import Link from "next/link";
import CommunityShell from "@/components/community/CommunityShell";
import { MemberResetForm } from "@/components/community/MemberForms";
import { findMemberLink } from "@/lib/community/auth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu cuenta · Nail Fest", robots: { index: false, follow: false }, referrer: "no-referrer" };

// nailfest.lat/cuenta/clave/<token> — a link the team sent her for a new
// password. Opening it changes nothing; only the form spends it.
export default async function CuentaClavePage({ params }: { params: { token: string } }) {
  const link = await findMemberLink(params.token);
  return (
    <CommunityShell section="Mi cuenta" identity={null} returnTo="/consultorio">
      <div className="cs-wrap">
        {link ? (
          <>
            <h1 className={`cs-h1 ${fraunces.className}`}>Crea una contraseña nueva</h1>
            <p className="cs-lede">
              Para tu cuenta <b>{link.member.email}</b>. Al guardarla, se cierran las sesiones que tengas abiertas en otros celulares o computadores.
            </p>
            <MemberResetForm token={params.token} />
          </>
        ) : (
          <>
            <h1 className={`cs-h1 ${fraunces.className}`}>Este enlace ya no sirve</h1>
            <p className="cs-lede">Ya se usó o venció (duran 7 días). Pídele al equipo de Nail Fest uno nuevo.</p>
            <Link href="/cuenta/entrar" className="bib-btn bib-btn-line pt-wide">
              Ir a entrar
            </Link>
          </>
        )}
      </div>
    </CommunityShell>
  );
}
