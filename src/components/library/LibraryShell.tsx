import type { ReactNode } from "react";
import Link from "next/link";
import PreviewToast from "@/components/cuponera/PreviewToast";
import type { LibraryViewer } from "@/lib/library/data";

type Section = "biblioteca" | "instructoras";

const LABELS: Record<Section, string> = { biblioteca: "Biblioteca", instructoras: "Instructoras" };

/** The staff banner: why this page isn't what visitors see. */
export function libraryStaffNote(viewer: LibraryViewer, section: Section, hasExamples: boolean): string | null {
  if (!viewer.staff) return null;
  const published = section === "biblioteca" ? viewer.config.published : viewer.config.instructorsPublished;
  const notes: string[] = [];
  if (!published) notes.push(`${section === "biblioteca" ? "La biblioteca todavía no es pública" : "El directorio de instructoras todavía no es público"}: el resto de las personas ven «página no encontrada».`);
  if (hasExamples) notes.push("Lo marcado «Ejemplo» es inventado y solo lo ve el equipo.");
  return notes.length ? notes.join(" ") : null;
}

// What every page of the library and the instructors' directory shares:
// the staff banner while there's something visitors don't see, the header
// with the menu (only to the pages this viewer can open), the footer, and
// the note that confirms a copied code.
export default function LibraryShell({ section, viewer, note, children }: { section: Section; viewer: LibraryViewer; note: string | null; children: ReactNode }) {
  const links = [
    { href: "/biblioteca", label: "Biblioteca", show: viewer.staff || viewer.config.published },
    { href: "/instructoras", label: "Instructoras", show: viewer.staff || viewer.config.instructorsPublished },
    { href: "/cuponera", label: "Cuponera", show: viewer.cuponeraLive },
  ].filter((l) => l.show);
  return (
    <main className="bib-page">
      {note && (
        <div className="bib-preview">
          <span>
            <b>Vista previa del equipo.</b> {note}
          </span>
          <Link href="/admin/biblioteca">Ir a Editar biblioteca</Link>
        </div>
      )}
      <header className="bib-header">
        <div className="bib-header-inner">
          <Link href={`/${section}`} className="bib-brand" aria-label={`${LABELS[section]} Nail Fest, inicio`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>{LABELS[section]}</span>
          </Link>
          {links.length > 1 && (
            <details className="bib-menu">
              <summary aria-label="Abrir el menú">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </summary>
              <nav aria-label="Secciones de Nail Fest">
                {links.map((l) => (
                  <Link key={l.href} href={l.href} aria-current={l.href === `/${section}` ? "page" : undefined}>
                    {l.label}
                  </Link>
                ))}
              </nav>
            </details>
          )}
        </div>
      </header>
      {children}
      <footer className="bib-footer">
        <span className="bib-brand bib-footer-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
          <img src="/logo.png" alt="Nail Fest" />
          <span>{LABELS[section]}</span>
        </span>
        <p>
          {section === "biblioteca"
            ? "Los videos se ven desde YouTube. Los descuentos de «Lo que usó» son de la Cuponera Nail Fest y se usan en la tienda en línea de cada marca."
            : "Las Instructoras Nail Fest son educadoras elegidas por Nail Fest. Las clases y servicios los da cada instructora."}
        </p>
        <a href="/privacidad">Política de privacidad</a>
      </footer>
      <PreviewToast />
    </main>
  );
}
