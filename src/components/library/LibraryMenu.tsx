"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LIBRARY_LEVELS, type LibraryMenuData } from "@/lib/library/shared";
import { Avatar, SearchIcon, ThemeIcon } from "./parts";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS = {
  home: <path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />,
  shorties: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" />
      <path d="M10.5 9.2v5.6l4.4-2.8z" fill="currentColor" />
    </>
  ),
  fresh: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10.5l5-3v9l-5-3z" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17.5" cy="9" r="2.5" />
      <path d="M16.5 14.6A5 5 0 0 1 21.5 20" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.5" />
    </>
  ),
};

type Current = "inicio" | "shorties" | "instructoras" | null;

function currentOf(pathname: string): Current {
  if (pathname === "/biblioteca") return "inicio";
  if (pathname.startsWith("/biblioteca/shorties")) return "shorties";
  if (pathname.startsWith("/instructoras")) return "instructoras";
  return null;
}

interface MenuLink {
  href: string;
  label: string;
  icon: ReactNode;
  tone: string;
  current?: boolean;
  badge?: string | null;
}

// The menu of every page of the library, Shorties and the instructors'
// directory (the approved mockup of 2026-10-24): the search, the sections,
// and the ways to search — by theme, level, instructor and city. Only what
// this viewer can open shows; a modal panel from the right, closed with
// its X, Escape, a tap outside or by following any of its links.
export default function LibraryMenu({
  menu,
  titleClass,
  dark = false,
  onOpenChange,
}: {
  menu: LibraryMenuData;
  titleClass: string;
  /** Shorties' version: a light button over the video. */
  dark?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  // Shorties has two menus (phone and computer): each its own search box.
  const searchId = useId();
  const current = currentOf(usePathname() ?? "");
  const notify = useRef(onOpenChange);
  notify.current = onOpenChange;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const closed = () => {
      setOpen(false);
      notify.current?.(false);
    };
    d.addEventListener("close", closed);
    return () => d.removeEventListener("close", closed);
  }, []);

  const show = () => {
    const d = dialog.current;
    if (!d || d.open) return;
    d.showModal();
    // The X, not the search: on a phone the keyboard would cover the menu.
    closeButton.current?.focus();
    setOpen(true);
    notify.current?.(true);
  };
  const close = () => dialog.current?.close();

  const { texts, sections } = menu;
  const links = (
    [
      menu.library && { href: "/biblioteca", label: texts.home, icon: ICONS.home, tone: "bib-tone-mint", current: current === "inicio" },
      menu.shorties && {
        href: "/biblioteca/shorties",
        label: texts.shorties,
        icon: ICONS.shorties,
        tone: "bib-drawer-ic--dark",
        current: current === "shorties",
        badge: sections.badge ? texts.badge : null,
      },
      menu.videos && { href: "/biblioteca/buscar?tipo=video", label: texts.newest, icon: ICONS.fresh, tone: "bib-tone-sky" },
      menu.mostViewed && { href: "/biblioteca#lo-mas-visto", label: texts.mostViewed, icon: ICONS.trend, tone: "bib-tone-rose" },
      menu.recordings && { href: "/biblioteca/buscar?tipo=maraton", label: texts.recordings, icon: ICONS.camera, tone: "bib-tone-lilac" },
      menu.instructors && { href: "/instructoras", label: texts.directory, icon: ICONS.people, tone: "bib-tone-peach", current: current === "instructoras" },
      menu.cuponera && { href: "/cuponera", label: texts.cuponera, icon: ICONS.tag, tone: "bib-tone-sand" },
    ] as (MenuLink | false)[]
  ).filter((l): l is MenuLink => Boolean(l));

  return (
    <>
      <button
        type="button"
        className={`bib-burger${dark ? " bib-burger--dark" : ""}`}
        aria-label="Abrir el menú"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={show}
      >
        <Icon>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </Icon>
      </button>
      <dialog
        ref={dialog}
        className="bib-drawer"
        aria-label="Menú"
        onClick={(e) => {
          // A tap on the dimmed page, or on any link (it's going elsewhere).
          if (e.target === e.currentTarget || (e.target as Element).closest("a")) close();
        }}
      >
        <div className="bib-drawer-top">
          <Link href={menu.library ? "/biblioteca" : "/instructoras"} className="bib-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>{menu.library ? "Biblioteca" : "Instructoras"}</span>
          </Link>
          <button ref={closeButton} type="button" className="bib-drawer-close" aria-label="Cerrar el menú" onClick={close}>
            <Icon>
              <path d="M6 6l12 12M18 6L6 18" />
            </Icon>
          </button>
        </div>

        {(menu.library || menu.instructors) && (
          <div className="bib-drawer-search">
            <form className="bib-search" role="search" action={menu.library ? "/biblioteca/buscar" : "/instructoras"} method="get" onSubmit={close}>
              <SearchIcon size={18} />
              <label htmlFor={searchId} className="bib-sr">
                {menu.library ? "Buscar en la biblioteca" : "Buscar instructoras"}
              </label>
              <input
                id={searchId}
                name="q"
                type="search"
                placeholder={menu.library ? texts.searchPlaceholder : texts.directorySearchPlaceholder}
                enterKeyHint="search"
                autoComplete="off"
              />
            </form>
            {menu.popularSearches.length > 0 && (
              <div className="bib-popular">
                <span>Lo más buscado:</span>
                {menu.popularSearches.map((q) => (
                  <Link key={q} href={`/biblioteca/buscar?q=${encodeURIComponent(q)}`} className="bib-pchip">
                    {q}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {links.length > 0 && (
          <nav className="bib-drawer-block" aria-label={texts.sectionsTitle}>
            <span className="bib-label">{texts.sectionsTitle}</span>
            <div className="bib-drawer-links">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="bib-drawer-link" aria-current={l.current ? "page" : undefined}>
                  <span className={`bib-drawer-ic ${l.tone}`}>
                    <Icon>{l.icon}</Icon>
                  </span>
                  {l.label}
                  {l.badge && <em className="bib-new">{l.badge}</em>}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {sections.themes && menu.themes.length > 0 && (
          <div className="bib-drawer-block">
            <span className="bib-label">{texts.themesTitle}</span>
            <div className="bib-drawer-themes">
              {menu.themes.map((t) => (
                <Link key={t.key} href={`/biblioteca/buscar?tema=${t.key}`} className={`bib-drawer-theme ${t.tile}`}>
                  <span className="bib-drawer-theme-ic">
                    <ThemeIcon icon={t.icon} />
                  </span>
                  <b>{t.label}</b>
                  <small aria-label={t.count === 1 ? "1 video" : `${t.count} videos`}>{t.count}</small>
                </Link>
              ))}
            </div>
          </div>
        )}

        {sections.levels && menu.videos && (
          <div className="bib-drawer-block">
            <span className="bib-label">{texts.levelsTitle}</span>
            <div className="bib-drawer-chips">
              {LIBRARY_LEVELS.map((l) => (
                <Link key={l.key} href={`/biblioteca/buscar?nivel=${l.key}`} className="bib-chip">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {sections.instructors && menu.people.length > 0 && (
          <div className="bib-drawer-block">
            <div className="bib-drawer-head">
              <span className="bib-label">{texts.instructorsTitle}</span>
              <Link href="/instructoras">{texts.seeAll}</Link>
            </div>
            <div className="bib-people">
              {menu.people.map((p) => (
                <Link key={p.slug} href={`/instructoras/${p.slug}`} className="bib-person">
                  <Avatar person={p} className="bib-person-face" />
                  <b>{p.name}</b>
                  <small>{p.city}</small>
                </Link>
              ))}
            </div>
          </div>
        )}

        {sections.cities && menu.cities.length > 0 && (
          <div className="bib-drawer-block">
            <span className="bib-label">{texts.citiesTitle}</span>
            <div className="bib-drawer-chips">
              {menu.cities.map((c) => (
                <Link key={c} href={`/instructoras?ciudad=${encodeURIComponent(c)}`} className="bib-chip">
                  {c}
                </Link>
              ))}
            </div>
          </div>
        )}

        {menu.signup && (
          <div className="bib-drawer-block">
            <div className="bib-signup">
              <h3 className={titleClass}>{texts.signupTitle}</h3>
              <p>{texts.signupText}</p>
              <Link href="/biblioteca/registro" className="bib-btn bib-btn-main bib-btn-sm">
                {texts.signupButton}
              </Link>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
