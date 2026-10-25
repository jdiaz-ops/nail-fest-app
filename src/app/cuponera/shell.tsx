import type { ReactNode } from "react";
import Link from "next/link";
import CuponeraHeader from "@/components/cuponera/CuponeraHeader";
import { getSiteMenu } from "@/lib/community/home";
import { getLibraryViewer } from "@/lib/library/data";
import CuponeraFooter from "@/components/cuponera/CuponeraFooter";
import PreviewToast from "@/components/cuponera/PreviewToast";
import { staffNote, type CuponeraPageData } from "./load";

// Inside Editar cuponera's live preview (an iframe) the staff banner is
// noise — that screen says whether the page is public. Runs before the
// banner is painted, on every page the preview navigates to.
const FRAME_SCRIPT = `if (window.self !== window.top) document.documentElement.classList.add("cup-in-frame");`;

// What every cuponera page shares: the staff banner while it isn't public,
// the header with Nail Fest's one menu, the footer, and the note that
// confirms a copied code.
export default async function CuponeraShell({ data, children }: { data: CuponeraPageData; children: ReactNode }) {
  const note = staffNote(data);
  const menu = await getSiteMenu(await getLibraryViewer());
  return (
    <main className="cup-page">
      <script dangerouslySetInnerHTML={{ __html: FRAME_SCRIPT }} />
      {note && (
        <div className="cup-preview">
          <span>
            <b>Vista previa del equipo.</b> {note}
          </span>
          <Link href="/admin/cuponera">Ir a Editar cuponera</Link>
        </div>
      )}
      <CuponeraHeader brands={data.brands} categories={data.categories} menu={menu} />
      {children}
      <CuponeraFooter />
      <PreviewToast />
    </main>
  );
}
