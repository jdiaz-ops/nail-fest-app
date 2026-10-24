import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import CommunityShell from "@/components/community/CommunityShell";
import { MemberLoginForm } from "@/components/community/MemberForms";
import { getConsultorioIdentity } from "@/lib/community/auth";
import { safeReturn } from "@/lib/community/consultorio";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Entrar · Nail Fest", robots: { index: false, follow: false } };

// nailfest.lat/cuenta/entrar — her community account; back to where she
// was (?volver=). Instructors enter with their portal account instead.
export default async function EntrarCuentaPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const identity = await getConsultorioIdentity();
  const back = safeReturn(searchParams.volver);
  if (identity?.kind === "MEMBER") redirect(back);

  return (
    <CommunityShell section="Mi cuenta" identity={identity} returnTo={back}>
      <div className="cs-wrap">
        <h1 className={`cs-h1 ${fraunces.className}`}>Entra a tu cuenta</h1>
        <p className="cs-lede">Para preguntar, responder y votar en el Consultorio.</p>
        <MemberLoginForm returnTo={back} />
        <p className="pt-center">
          ¿No tienes cuenta? <Link href={`/cuenta/crear?volver=${encodeURIComponent(back)}`}>Crea una gratis</Link>
        </p>
        <p className="pt-center">
          ¿Eres instructora del directorio? <Link href={`/instructoras/entrar?volver=${encodeURIComponent(back)}`}>Entra con tu cuenta del portal</Link>
        </p>
      </div>
    </CommunityShell>
  );
}
