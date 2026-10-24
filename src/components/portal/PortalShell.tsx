import type { ReactNode } from "react";
import Link from "next/link";
import type { Instructor } from "@prisma/client";
import { initialOf, toneOf } from "@/lib/library/shared";
import { PortalIcon } from "./icons";

export type PortalTab = "inicio" | "perfil" | "videos" | "cuenta";

const TABS: { key: PortalTab; label: string; href: string; icon: "home" | "person" | "play" | "gear" }[] = [
  { key: "inicio", label: "Inicio", href: "/instructoras/portal", icon: "home" },
  { key: "perfil", label: "Perfil", href: "/instructoras/portal/perfil", icon: "person" },
  { key: "videos", label: "Videos", href: "/instructoras/portal/videos", icon: "play" },
  { key: "cuenta", label: "Cuenta", href: "/instructoras/portal/cuenta", icon: "gear" },
];

/** Her photo, or her initial on her color — the directory's own look. */
export function PortalFace({ instructor, big = false }: { instructor: Pick<Instructor, "name" | "slug" | "photoUrl">; big?: boolean }) {
  return (
    <span className={`pt-face${big ? " pt-face--big" : ""} bib-ph-${toneOf(instructor.slug)}`} aria-hidden="true">
      {instructor.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- her own upload (Vercel Blob)
        <img src={instructor.photoUrl} alt="" />
      ) : (
        initialOf(instructor.name)
      )}
    </span>
  );
}

// Every page of the instructors' portal and its way in: the directory's
// header — with her face once she's logged in, or "Entrar" — and, inside
// the portal, the tab bar at the bottom (no classes: 2026-10-24).
export default function PortalShell({
  instructor,
  tab,
  aside,
  note = null,
  children,
}: {
  /** Logged in: her face in the header, linking to the portal. */
  instructor?: Pick<Instructor, "name" | "slug" | "photoUrl"> | null;
  /** Inside the portal: which tab is lit. */
  tab?: PortalTab;
  /** The header's right side when it isn't her face. */
  aside?: ReactNode;
  /** The team's banner: why this page isn't what visitors see. */
  note?: string | null;
  children: ReactNode;
}) {
  return (
    <main className={`pt-page${tab ? " pt-page--tabs" : ""}`}>
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
          <Link href={instructor ? "/instructoras/portal" : "/instructoras"} className="bib-brand" aria-label="Instructoras Nail Fest">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>Instructoras</span>
          </Link>
          {instructor ? (
            <Link href="/instructoras/portal/cuenta" className="pt-me" aria-label={`Tu cuenta, ${instructor.name}`}>
              <PortalFace instructor={instructor} />
              {instructor.name.split(" ")[0]}
            </Link>
          ) : (
            aside
          )}
        </div>
      </header>
      {children}
      {tab && (
        <nav className="pt-tabs" aria-label="Tu portal">
          <div className="pt-tabs-inner">
            {TABS.map((t) => (
              <Link key={t.key} href={t.href} className="pt-tab" aria-current={t.key === tab ? "page" : undefined}>
                <PortalIcon name={t.icon} size={22} />
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </main>
  );
}
