import Link from "next/link";
import LibraryMenu from "@/components/library/LibraryMenu";
import { fraunces } from "@/app/cuponera/fonts";
import type { CuponeraCategoryLink } from "@/lib/cuponera/browse";
import type { CuponeraBrandCard } from "@/lib/cuponera/shared";
import type { LibraryMenuData } from "@/lib/library/shared";

// The cuponera's header: Nail Fest's one menu on the left (since
// 2026-10-25, instead of its own — with the brands' discounts and the
// categories right after the sections) and the logo on the right, back to
// the front page.
export default function CuponeraHeader({ brands, categories, menu }: { brands: CuponeraBrandCard[]; categories: CuponeraCategoryLink[]; menu: LibraryMenuData }) {
  return (
    <header className="cup-header">
      <div className="cup-header-inner">
        <LibraryMenu menu={menu} titleClass={fraunces.className} section={{ label: "Cuponera", href: "/cuponera" }} cuponera={{ brands, categories }} />
        <Link href="/cuponera" className="cup-brand" aria-label="Cuponera Nail Fest, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
          <img src="/logo.png" alt="Nail Fest" />
          <span>Cuponera</span>
        </Link>
      </div>
    </header>
  );
}
