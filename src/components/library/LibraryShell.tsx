import type { ReactNode } from "react";
import Link from "next/link";
import PreviewToast from "@/components/cuponera/PreviewToast";
import { getLibraryMenu, type LibraryViewer } from "@/lib/library/data";
import { fraunces } from "@/app/cuponera/fonts";
import LibraryMenu from "./LibraryMenu";

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
// with the menu (./LibraryMenu: the sections and ways to search this viewer
// can open), the footer, and the note that confirms a copied code.
export default async function LibraryShell({ section, viewer, note, children }: { section: Section; viewer: LibraryViewer; note: string | null; children: ReactNode }) {
  const menu = await getLibraryMenu(viewer);
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
          <LibraryMenu menu={menu} titleClass={fraunces.className} />
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
            ? "Los videos se ven desde YouTube. Los descuentos de «Lo que usó» son de la Cuponera Nail Fest y se usan en la tienda en línea de cada marca; Nail Fest puede recibir una comisión por esas compras."
            : "Las Instructoras Nail Fest son educadoras de uñas elegidas por Nail Fest. Cada una organiza y cobra sus propias clases."}
        </p>
        <a href="/privacidad">Política de privacidad</a>
      </footer>
      <PreviewToast />
    </main>
  );
}
