import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import LibraryMenu from "@/components/library/LibraryMenu";
import PreviewToast from "@/components/cuponera/PreviewToast";
import type { ConsultorioIdentity } from "@/lib/community/auth";
import { communityMenuLinks, getCommunityParts, getSiteMenu } from "@/lib/community/home";
import { getLibraryViewer } from "@/lib/library/data";
import { getNextEvent } from "@/lib/nextEvent";
import { getOrgSettings } from "@/lib/settings";
import { fraunces } from "@/app/cuponera/fonts";

// The community's pages — the Consultorio and the community account: the
// header with Nail Fest's one menu (☰ on the left, the logo on the right),
// the team's banner while it isn't public, and a footer with the rest of
// the community.
export default async function CommunityShell({
  section,
  identity,
  returnTo,
  note = null,
  composer = false,
  children,
}: {
  section: "Consultorio" | "Mi cuenta";
  identity: ConsultorioIdentity | null;
  /** Where the menu's "Entrar" brings her back to. */
  returnTo: string;
  note?: string | null;
  /** A fixed box to answer at the bottom: room for it. */
  composer?: boolean;
  children: ReactNode;
}) {
  const [viewer, org, nextEvent] = await Promise.all([getLibraryViewer(), getOrgSettings(), getNextEvent()]);
  const [menu, parts] = await Promise.all([getSiteMenu(viewer), getCommunityParts(viewer)]);
  const links = communityMenuLinks(parts, nextEvent, org.homepageCommunity ? "/" : viewer.staff ? "/?vista=comunidad" : null);
  // Her "Entrar" brings her back to this page.
  const site = !identity && menu.account ? { ...menu, account: { ...menu.account, href: `/cuenta/entrar?volver=${encodeURIComponent(returnTo)}` } } : menu;
  const home = section === "Consultorio" ? "/consultorio" : "/cuenta";
  return (
    <main className={`cs-page${composer ? " cs-page--composer" : ""}`}>
      {note && (
        <div className="bib-preview">
          <span>
            <b>Vista previa del equipo.</b> {note}
          </span>
          <Link href="/admin/consultorio">Ir a Consultorio</Link>
        </div>
      )}
      <header className="bib-header">
        <div className="bib-header-inner">
          <LibraryMenu menu={site} titleClass={fraunces.className} section={{ label: section, href: home }} />
          <Link href={home} className="bib-brand" aria-label={`${section} Nail Fest`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>{section}</span>
          </Link>
        </div>
      </header>
      {children}
      <footer className="bib-footer">
        <p>
          {links.map((l, i) => (
            <Fragment key={l.href}>
              {i > 0 && " · "}
              <Link href={l.href}>{l.label}</Link>
            </Fragment>
          ))}
        </p>
        <p>
          <a href="/privacidad">Política de privacidad</a>
        </p>
      </footer>
      <PreviewToast />
    </main>
  );
}
