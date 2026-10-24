import type { Event } from "@prisma/client";
import { db } from "@/lib/db";
import { getCuponeraSettings } from "@/lib/cuponera/settings";
import { publicEventName } from "@/lib/eventDisplayName";
import { getCortosTopics, getInstructorCards, getShorties, shortiesCount, type LibraryViewer } from "@/lib/library/data";
import { SHORTIES_SHOWN_FROM, formatDuration, toneOf, type CortosTopic, type InstructorCard } from "@/lib/library/shared";
import type { SiteMenuLink } from "@/components/community/SiteMenu";
import type { ConsultorioIdentity } from "./auth";
import { countQuestions, latestQuestions, type QuestionCard } from "./data";

// The homepage as the community's home (OrgSettings.homepageCommunity,
// 2026-10-24): one place to reach everything — the cortos to learn, the
// cuponera's discounts, the instructors, the Consultorio, the library and
// the next events. Each part shows only once it's public; the team sees
// every part, to preview it.

export interface HomeCorto {
  slug: string;
  title: string;
  youtubeId: string | null;
  tone: number;
  duration: string | null;
  instructor: string | null;
}

export interface HomeBrand {
  id: string;
  name: string;
  initial: string;
  logoUrl: string | null;
  discountPercent: number;
}

export interface CommunityHome {
  cortos: { show: boolean; count: number; items: HomeCorto[]; topics: CortosTopic[] };
  library: { show: boolean };
  cuponera: { show: boolean; count: number; brands: HomeBrand[] };
  instructors: { show: boolean; count: number; people: InstructorCard[]; joinOpen: boolean };
  consultorio: { show: boolean; count: number; questions: QuestionCard[] };
  /** The events after the one in the hero. */
  moreEvents: Event[];
}

const CORTOS_UP_TO = 10;
const BRANDS_UP_TO = 8;
const PEOPLE_UP_TO = 10;
const QUESTIONS_UP_TO = 3;

export async function getCommunityHome(viewer: LibraryViewer, nextEventId: string | null, now: Date = new Date()): Promise<CommunityHome> {
  const { config, staff } = viewer;
  const libraryOpen = config.published || staff;
  const cortosOpen = libraryOpen && (config.sections.shorties || staff);
  const [cuponeraSettings, shorts, topics, brands, people, questionCount, questions, events] = await Promise.all([
    getCuponeraSettings(),
    cortosOpen ? getShorties(viewer, now) : Promise.resolve([]),
    cortosOpen ? getCortosTopics(viewer, now) : Promise.resolve([]),
    db.cuponeraBrand.findMany({ where: { visible: true, available: true }, orderBy: { order: "asc" } }),
    config.instructorsPublished || staff ? getInstructorCards(viewer, now) : Promise.resolve([]),
    config.consultorioPublished || staff ? countQuestions() : Promise.resolve(0),
    config.consultorioPublished || staff ? latestQuestions(QUESTIONS_UP_TO) : Promise.resolve([]),
    db.event.findMany({ where: { status: "PUBLISHED", startsAt: { gte: now } }, orderBy: { startsAt: "asc" }, take: 4 }),
  ]);
  const realCortos = shorts.filter((s) => !s.video.sample).length;
  return {
    cortos: {
      show: cortosOpen && (staff || realCortos >= SHORTIES_SHOWN_FROM),
      count: realCortos,
      items: shorts.slice(0, CORTOS_UP_TO).map(({ video }) => ({
        slug: video.slug,
        title: video.title,
        youtubeId: video.youtubeId,
        tone: toneOf(video.slug),
        duration: video.durationSeconds != null ? formatDuration(video.durationSeconds) : null,
        instructor: video.instructor?.name ?? null,
      })),
      topics: topics.slice(0, 10),
    },
    library: { show: libraryOpen },
    cuponera: {
      show: (cuponeraSettings.published || staff) && brands.length > 0,
      count: brands.length,
      brands: brands.slice(0, BRANDS_UP_TO).map((b) => ({
        id: b.id,
        name: b.name,
        initial: b.name.trim().charAt(0).toUpperCase() || "·",
        logoUrl: b.logoUrl,
        discountPercent: Number(b.discountPercent),
      })),
    },
    instructors: {
      show: people.length > 0,
      count: people.filter((p) => !p.sample).length,
      people: people.slice(0, PEOPLE_UP_TO),
      joinOpen: config.portalOpen,
    },
    consultorio: { show: config.consultorioPublished || staff, count: questionCount, questions },
    moreEvents: events.filter((e) => e.id !== nextEventId).slice(0, 3),
  };
}

// ── The community's menu ────────────────────────────────────────────────────

/** The parts of Nail Fest this viewer can open: the community menu's links. */
export interface CommunityParts {
  cortos: boolean;
  cuponera: boolean;
  consultorio: boolean;
  instructors: boolean;
  library: boolean;
}

export function partsOf(home: CommunityHome): CommunityParts {
  return { cortos: home.cortos.show, cuponera: home.cuponera.show, consultorio: home.consultorio.show, instructors: home.instructors.show, library: home.library.show };
}

/** The same parts as the community home shows, without its contents — for
 * the menu of the other community pages (the Consultorio, the account). */
export async function getCommunityParts(viewer: LibraryViewer): Promise<CommunityParts> {
  const { config, staff } = viewer;
  const libraryOpen = config.published || staff;
  const [cuponeraSettings, brands, cortos] = await Promise.all([
    getCuponeraSettings(),
    db.cuponeraBrand.count({ where: { visible: true, available: true } }),
    libraryOpen && config.sections.shorties && !staff ? shortiesCount() : Promise.resolve(0),
  ]);
  return {
    cortos: libraryOpen && (staff || (config.sections.shorties && cortos >= SHORTIES_SHOWN_FROM)),
    cuponera: (cuponeraSettings.published || staff) && brands > 0,
    consultorio: config.consultorioPublished || staff,
    instructors: config.instructorsPublished || staff,
    library: libraryOpen,
  };
}

/** The menu's links: the community home (when it's on, or the team's
 * preview of it), the next event, then each part this viewer can open. */
export function communityMenuLinks(parts: CommunityParts, nextEvent: Event | null, home: string | null): SiteMenuLink[] {
  const links: (SiteMenuLink | false)[] = [
    home !== null && { href: home, label: "Inicio", icon: "home" },
    nextEvent !== null && { href: `/${nextEvent.slug}`, label: publicEventName(nextEvent), hint: "El próximo evento", icon: "event" },
    parts.cortos && { href: "/biblioteca/cortos", label: "Cortos", hint: "Aprende en un minuto", icon: "cortos" },
    parts.cuponera && { href: "/cuponera", label: "Descuentos", hint: "La cuponera", icon: "tag" },
    parts.consultorio && { href: "/consultorio", label: "Consultorio", hint: "Pregunta y responde", icon: "chat" },
    parts.instructors && { href: "/instructoras", label: "Instructoras", hint: "El directorio", icon: "people" },
    parts.library && { href: "/biblioteca", label: "Biblioteca", hint: "Clases y maratones", icon: "book" },
  ];
  return links.filter((l): l is SiteMenuLink => Boolean(l));
}

/** Her way in, at the menu's foot: her account, her instructor's portal,
 * or "Entrar" once the Consultorio is open. The team has the admin. */
export function communityAccountLink(identity: ConsultorioIdentity | null, consultorio: boolean): SiteMenuLink | null {
  if (identity?.kind === "MEMBER") return { href: "/cuenta", label: "Mi cuenta", icon: "person" };
  if (identity?.kind === "INSTRUCTOR") return { href: "/instructoras/portal", label: "Mi portal de instructora", icon: "person" };
  if (!identity && consultorio) return { href: "/cuenta/entrar?volver=/consultorio", label: "Entrar a mi cuenta", icon: "person" };
  return null;
}
