import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import LeadForm from "@/components/library/LeadForm";
import { getLibraryViewer } from "@/lib/library/data";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Instructoras · Nail Fest", robots: { index: false, follow: false } };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// nailfest.lat/instructoras/solicitud — an instructor applying to the
// directory (?tipo=postulacion). What's sent lands in Editar biblioteca →
// Registros. The brand requests and the class bookings it also took are
// gone (2026-10-25): ?tipo=marca and ?tipo=clase are "not found".
export default async function SolicitudPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const viewer = await getLibraryViewer();
  if (!viewer.config.instructorsPublished && !viewer.staff) notFound();
  const tipo = one(searchParams.tipo);
  if (tipo && tipo !== "postulacion") notFound();
  const { texts } = viewer.config;

  return (
    <LibraryShell section="instructoras" viewer={viewer} note={libraryStaffNote(viewer, "instructoras", false)}>
      <div className="bib-wrap bib-wrap--form">
        <Link href="/instructoras" className="bib-back bib-back--dark">
          ← Todas las instructoras
        </Link>
        <h1 className={`bib-h1 ${fraunces.className}`}>{texts.applyFormTitle}</h1>
        <p className="bib-form-lede">{texts.applyFormText}</p>
        <LeadForm kind="POSTULACION" instructor={null} context={null} returnTo={null} thanksText={texts.thanksText} sample={false} />
      </div>
    </LibraryShell>
  );
}
