import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import CommunityShell from "@/components/community/CommunityShell";
import { MemberSignupForm } from "@/components/community/MemberForms";
import { getLibrarySettings } from "@/lib/library/settings";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getConsultorioIdentity } from "@/lib/community/auth";
import { CONSULTORIO_RULES, safeReturn } from "@/lib/community/consultorio";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Crea tu cuenta · Nail Fest", robots: { index: false, follow: false } };

// nailfest.lat/cuenta/crear — the community account, to take part in the
// Consultorio. Back to where she was (?volver=) once it's made.
export default async function CrearCuentaPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const [settings, staff, identity] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples(), getConsultorioIdentity()]);
  const back = safeReturn(searchParams.volver);
  if (identity?.kind === "MEMBER") redirect(back);
  if (!settings.consultorioPublished && !staff) notFound();

  return (
    <CommunityShell section="Mi cuenta" identity={identity} returnTo={back} note={settings.consultorioPublished ? null : "El Consultorio todavía no es público: solo el equipo puede crear cuentas aquí."}>
      <div className="cs-wrap">
        <h1 className={`cs-h1 ${fraunces.className}`}>Crea tu cuenta</h1>
        <p className="cs-lede">Gratis. Para preguntar, responder y votar en el Consultorio de Nail Fest.</p>
        <MemberSignupForm returnTo={back} />
        <div className="pt-card pt-card--soft">
          <h2 className="pt-h3">Las reglas del Consultorio</h2>
          <ul className="cs-rules">
            {CONSULTORIO_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <p className="pt-center">
          ¿Ya tienes cuenta? <Link href={`/cuenta/entrar?volver=${encodeURIComponent(back)}`}>Entrar</Link>
        </p>
        <p className="pt-center">
          ¿Eres instructora del directorio? <Link href={`/instructoras/entrar?volver=${encodeURIComponent(back)}`}>Entra con tu cuenta del portal</Link>
        </p>
      </div>
    </CommunityShell>
  );
}
