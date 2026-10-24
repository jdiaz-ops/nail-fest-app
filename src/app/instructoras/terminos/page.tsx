import type { Metadata } from "next";
import Link from "next/link";
import PortalShell from "@/components/portal/PortalShell";
import { getLibraryViewer } from "@/lib/library/data";
import { getPortalUser } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Términos del directorio de instructoras · Nail Fest", robots: { index: false, follow: true } };

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

// nailfest.lat/instructoras/terminos — what instructors accept: the
// directory's terms (at sign-up) and the content permission (#contenido,
// with their first video). Both texts live in Editar biblioteca → Textos.
export default async function TerminosPage() {
  const [viewer, user] = await Promise.all([getLibraryViewer(), getPortalUser()]);
  const { texts } = viewer.config;

  return (
    <PortalShell instructor={user?.instructor}>
      <div className="pt-wrap">
        <Link href={user ? "/instructoras/portal" : "/instructoras/unirme"} className="bib-back bib-back--dark">
          ← Volver
        </Link>
        <h1 className={`pt-h1 ${fraunces.className}`}>Términos del directorio</h1>
        <div className="pt-legal">
          {paragraphs(texts.termsText).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <h2 id="contenido" className={fraunces.className}>
            Permiso de uso de contenido
          </h2>
          {paragraphs(texts.contentTermsText).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
    </PortalShell>
  );
}
