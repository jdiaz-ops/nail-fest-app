import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import LibraryShell, { libraryStaffNote } from "@/components/library/LibraryShell";
import LeadForm from "@/components/library/LeadForm";
import { getInstructorProfile, getLibraryViewer, instructorForForm } from "@/lib/library/data";
import type { LibraryLeadKindKey } from "@/lib/library/leads";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Instructoras · Nail Fest", robots: { index: false, follow: false } };

const KINDS: Record<string, Exclude<LibraryLeadKindKey, "REGISTRO">> = { postulacion: "POSTULACION", marca: "MARCA", clase: "CLASE" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

// nailfest.lat/instructoras/solicitud — the instructors' three forms
// (?tipo=postulacion | marca | clase, &instructora=<slug>, &clase=<id>):
// an instructor applying, a brand looking for one (or for a given one) and
// a class booking. What's sent lands in Editar biblioteca → Registros.
export default async function SolicitudPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const viewer = await getLibraryViewer();
  if (!viewer.config.instructorsPublished && !viewer.staff) notFound();
  const kind = KINDS[one(searchParams.tipo)] ?? "POSTULACION";
  const instructor = await instructorForForm(one(searchParams.instructora) || null, viewer);
  if (kind === "CLASE" && !instructor) notFound();
  const { texts } = viewer.config;

  // The class being booked, named in the form and kept with the booking.
  let context: string | null = null;
  const classId = one(searchParams.clase);
  if (kind === "CLASE" && instructor && classId) {
    const profile = await getInstructorProfile(instructor.slug, viewer);
    context = profile?.classes.find((c) => c.id === classId)?.title ?? null;
  }

  const title = { POSTULACION: texts.applyFormTitle, MARCA: texts.brandFormTitle, CLASE: texts.classFormTitle }[kind];
  const lede = { POSTULACION: texts.applyFormText, MARCA: texts.brandFormText, CLASE: texts.classFormText }[kind];

  return (
    <LibraryShell section="instructoras" viewer={viewer} note={libraryStaffNote(viewer, "instructoras", Boolean(instructor?.sample))}>
      <div className="bib-wrap bib-wrap--form">
        <Link href={instructor ? `/instructoras/${instructor.slug}` : "/instructoras"} className="bib-back bib-back--dark">
          ← {instructor ? instructor.name : "Todas las instructoras"}
        </Link>
        <h1 className={`bib-h1 ${fraunces.className}`}>{title}</h1>
        <p className="bib-form-lede">{lede}</p>
        <LeadForm
          kind={kind}
          instructor={instructor ? { slug: instructor.slug, name: instructor.name } : null}
          context={context}
          returnTo={null}
          thanksText={texts.thanksText}
          sample={Boolean(instructor?.sample)}
        />
      </div>
    </LibraryShell>
  );
}
