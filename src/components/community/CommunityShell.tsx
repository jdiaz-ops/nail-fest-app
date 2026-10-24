import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import type { ConsultorioIdentity } from "@/lib/community/auth";
import { communityAccountLink, communityMenuLinks, getCommunityParts } from "@/lib/community/home";
import { getLibraryViewer } from "@/lib/library/data";
import { getNextEvent } from "@/lib/nextEvent";
import { getOrgSettings } from "@/lib/settings";
import SiteMenu from "./SiteMenu";

/** What the header says about who's here: her name, the team, or "Entrar". */
function whoIsHere(identity: ConsultorioIdentity | null, returnTo: string): ReactNode {
  if (!identity) {
    return (
      <Link href={`/cuenta/entrar?volver=${encodeURIComponent(returnTo)}`} className="pt-link">
        Entrar
      </Link>
    );
  }
  if (identity.kind === "TEAM") return <span className="cs-pill cs-pill--team">Equipo Nail Fest</span>;
  if (identity.kind === "INSTRUCTOR") {
    return (
      <Link href="/instructoras/portal" className="pt-me">
        {identity.instructor.name.split(" ")[0]}
      </Link>
    );
  }
  return (
    <Link href="/cuenta" className="pt-me" aria-label={`Tu cuenta, ${identity.member.name}`}>
      {identity.member.name.split(" ")[0]}
    </Link>
  );
}

// The community's pages — the Consultorio and the community account: the
// header with who's here and the community's menu, the team's banner while
// it isn't public, and a footer with the rest of the community.
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
  /** Where "Entrar" brings her back to. */
  returnTo: string;
  note?: string | null;
  /** A fixed box to answer at the bottom: room for it. */
  composer?: boolean;
  children: ReactNode;
}) {
  const [viewer, org, nextEvent] = await Promise.all([getLibraryViewer(), getOrgSettings(), getNextEvent()]);
  const parts = await getCommunityParts(viewer);
  const links = communityMenuLinks(parts, nextEvent, org.homepageCommunity ? "/" : viewer.staff ? "/?vista=comunidad" : null);
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
          <Link href="/consultorio" className="bib-brand" aria-label={`${section} Nail Fest`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>{section}</span>
          </Link>
          <div className="cs-head-actions">
            {whoIsHere(identity, returnTo)}
            <SiteMenu links={links} account={communityAccountLink(identity, parts.consultorio)} dark={false} />
          </div>
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
    </main>
  );
}
