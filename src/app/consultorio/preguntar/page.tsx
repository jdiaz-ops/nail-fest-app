import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityShell from "@/components/community/CommunityShell";
import { AskForm } from "@/components/community/ConsultorioActions";
import { getLibrarySettings } from "@/lib/library/settings";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getConsultorioIdentity, identityLabel } from "@/lib/community/auth";
import { CONSULTORIO_RULES, isConsultorioTopic } from "@/lib/community/consultorio";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Haz tu pregunta · Consultorio Nail Fest", robots: { index: false, follow: false } };

// "Haz tu pregunta": the form, for whoever is signed in — or the way to sign in.
export default async function PreguntarPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const [settings, staff, identity] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples(), getConsultorioIdentity()]);
  if (!settings.consultorioPublished && !staff) notFound();
  const topic = typeof searchParams.tema === "string" && isConsultorioTopic(searchParams.tema) ? searchParams.tema : null;
  const here = `/consultorio/preguntar${topic ? `?tema=${topic}` : ""}`;

  return (
    <CommunityShell section="Consultorio" identity={identity} returnTo={here} note={settings.consultorioPublished ? null : "El Consultorio todavía no es público."}>
      <div className="cs-wrap">
        <Link href="/consultorio" className="cs-back">
          ← Consultorio
        </Link>
        <h1 className={`cs-h1 ${fraunces.className}`}>Haz tu pregunta</h1>
        <p className="cs-lede">Otras manicuristas y las instructoras del directorio te responden aquí mismo.</p>
        {identity ? (
          <AskForm asLabel={identityLabel(identity)} initialTopic={topic} />
        ) : (
          <div className="cs-join">
            <b>Para preguntar, crea tu cuenta gratis</b>
            <p>Con tu nombre y tu ciudad. Tu correo no se publica.</p>
            <div className="pt-btns">
              <Link href={`/cuenta/crear?volver=${encodeURIComponent(here)}`} className="bib-btn bib-btn-main bib-btn-sm">
                Crear mi cuenta
              </Link>
              <Link href={`/cuenta/entrar?volver=${encodeURIComponent(here)}`} className="bib-btn bib-btn-line bib-btn-sm">
                Entrar
              </Link>
            </div>
          </div>
        )}
        <div className="pt-card pt-card--soft">
          <h2 className="pt-h3">Las reglas del Consultorio</h2>
          <ul className="cs-rules">
            {CONSULTORIO_RULES.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </CommunityShell>
  );
}
