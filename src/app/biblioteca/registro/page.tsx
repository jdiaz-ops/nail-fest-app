import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import LeadForm from "@/components/library/LeadForm";
import { getLibraryViewer } from "@/lib/library/data";
import { hasLibraryAccess } from "@/lib/library/access";
import { LIBRARY_SIGNUP } from "@/lib/library/texts";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Regístrate gratis · El Taller Nail Fest", robots: { index: false, follow: false } };

/** Back to the library page that asked for the sign-up (a corto keeps
 * its ?v= and its topic) — never anywhere else. */
function returnPath(value: string | string[] | undefined): string {
  const path = Array.isArray(value) ? value[0] : value;
  return path && /^\/biblioteca(?:\/[a-z0-9-]+)?(?:\?v=[a-z0-9-]+(?:&tema=[a-z0-9-]+)?|\?tema=[a-z0-9-]+)?$/.test(path) ? path : "/biblioteca";
}

// nailfest.lat/biblioteca/registro — the free sign-up that opens the
// marathons' recordings and the step by steps (on this browser), then
// takes the person back to the video that asked for it. While the library
// asks for no sign-up (LIBRARY_SIGNUP), it just takes them back.
export default async function BibliotecaRegistroPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const viewer = await getLibraryViewer();
  if (!viewer.videos) notFound();
  const { texts } = viewer.config;
  const back = returnPath(searchParams.volver);
  if (!LIBRARY_SIGNUP) redirect(back);
  const signedUp = hasLibraryAccess();

  return (
    <LibraryShell section="biblioteca" viewer={viewer} note={libraryStaffNote(viewer, "biblioteca", false)}>
      <div className="bib-wrap bib-wrap--form">
        <h1 className={`bib-h1 ${fraunces.className}`}>{texts.signupFormTitle}</h1>
        {signedUp ? (
          <div className="bib-thanks" role="status">
            <p>Ya te registraste en este celular o computador: las grabaciones y el paso a paso ya están abiertos.</p>
            <Link href={back} className="bib-btn bib-btn-dark">
              Volver
            </Link>
          </div>
        ) : (
          <>
            <p className="bib-form-lede">{texts.signupFormText}</p>
            <LeadForm kind="REGISTRO" instructor={null} context={back === "/biblioteca" ? null : back} returnTo={back} thanksText={texts.thanksText} sample={false} />
          </>
        )}
      </div>
    </LibraryShell>
  );
}
