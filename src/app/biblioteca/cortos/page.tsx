import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PreviewToast from "@/components/cuponera/PreviewToast";
import { libraryStaffNote } from "@/components/library/LibraryShell";
import ShortiesFeed from "@/components/library/ShortiesFeed";
import { getLibraryViewer, getShorties, libraryRobots, rankVideos } from "@/lib/library/data";
import { getSiteMenu } from "@/lib/community/home";
import { LIBRARY_ADMIN_NAME } from "@/lib/library/texts";
import {
  LIBRARY_THEMES,
  SHORTIES_SIGNUP_EVERY,
  feedRow,
  hasTopic,
  shortiesOrder,
  startAt,
  topicKey,
  topicsOf,
  type FeedFilters,
  type FeedPerson,
  type ShortItem,
} from "@/lib/library/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function one(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 120).trim() ?? "";
}

/** ?tema=polygel — a theme's key, a subcategory's or a tag's ("Nail art" → nail-art). */
function topicParam(searchParams: SearchParams): string | null {
  const key = topicKey(one(searchParams, "tema"));
  return key && key.length <= 60 ? key : null;
}

/** ?instructora=ana-prueba — her address in the directory. */
function personParam(searchParams: SearchParams): string | null {
  const slug = one(searchParams, "instructora").toLowerCase();
  return /^[a-z0-9-]{1,80}$/.test(slug) ? slug : null;
}

/** The instructors with videos in the scroll, the most videos first. */
function peopleOf(items: ShortItem[]): FeedPerson[] {
  const people = new Map<string, FeedPerson>();
  for (const { video } of items) {
    const person = video.instructor;
    if (!person?.slug) continue;
    const known = people.get(person.slug);
    if (known) known.count++;
    else people.set(person.slug, { slug: person.slug, name: person.name, initial: person.initial, photoUrl: person.photoUrl, tone: person.tone, count: 1 });
  }
  return [...people.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const viewer = await getLibraryViewer();
  const key = topicParam(searchParams);
  const topic = key ? topicsOf((await getShorties(viewer)).map((i) => i.video)).find((t) => t.key === key) : undefined;
  const title = viewer.config.texts.shortiesTitle;
  return {
    title: `${topic ? `${title}: ${topic.label}` : title} · El Taller Nail Fest`,
    description: topic ? `Videos de ${topic.label}, uno tras otro.` : "Los videos de las instructoras Nail Fest, uno tras otro.",
    robots: await libraryRobots("biblioteca"),
  };
}

// nailfest.lat/biblioteca/cortos ("Shorties" until 2026-10-24) — every
// video one after another, full screen: long or short, upright or lying
// (2026-10-25), in a new order every visit (?v= puts a shared one first).
// Its filters: a topic (?tema= a theme, a subcategory or a tag — the row on
// top and the chips on each video), an instructor (?instructora=), a search
// (?q=, the best first) and the newest first (?orden=nuevo). Switched off
// in Editar biblioteca, visitors get "page not found".
export default async function CortosPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getLibraryViewer();
  const { texts, sections } = viewer.config;
  if (!viewer.videos || (!sections.shorties && !viewer.staff)) notFound();
  const [all, menu] = await Promise.all([getShorties(viewer), getSiteMenu(viewer)]);
  const first = one(searchParams, "v") || null;
  const query = one(searchParams, "q");
  const newest = one(searchParams, "orden") === "nuevo";

  const people = peopleOf(all);
  const personSlug = personParam(searchParams);
  const person = people.find((p) => p.slug === personSlug) ?? null;
  const byPerson = person ? all.filter((i) => i.video.instructor?.slug === person.slug) : all;
  const topics = topicsOf(byPerson.map((i) => i.video));
  const key = topicParam(searchParams);
  const topic = key ? (topics.find((t) => t.key === key) ?? { key, label: key.replace(/-/g, " "), count: 0 }) : null;
  const inTopic = topic ? byPerson.filter((i) => hasTopic(i.video, topic.key)) : byPerson;
  const { found, relaxed } = rankVideos(inTopic, query, (i) => i.video);
  const byDate = () => [...inTopic].sort((a, b) => b.video.publishedAt.localeCompare(a.video.publishedAt));
  // A search or the newest: their order from the chosen one on; the rest, a new order every visit.
  const items = query ? startAt(found, first) : newest ? startAt(byDate(), first) : shortiesOrder(inTopic, first);
  const filters: FeedFilters = {
    topic: topic ? { key: topic.key, label: topic.label } : null,
    person: person ? { slug: person.slug, name: person.name } : null,
    query,
    newest,
    relaxed,
  };
  // The same videos as a list, on the search's page: a theme, its subcategory, or the words.
  const isTheme = (k: string) => LIBRARY_THEMES.some((t) => t.key === k);
  const sub = topic ? byPerson.flatMap((i) => i.video.subcategories).find((s) => s.key === topic.key) : undefined;
  const listHref = query
    ? `/biblioteca/buscar?q=${encodeURIComponent(query)}`
    : topic && isTheme(topic.key)
      ? `/biblioteca/buscar?tema=${topic.key}`
      : sub
        ? `/biblioteca/buscar?tema=${sub.theme}&sub=${sub.key}`
        : topic
          ? `/biblioteca/buscar?q=${encodeURIComponent(topic.label)}`
          : "/biblioteca/buscar";
  const notes = [
    libraryStaffNote(viewer, "biblioteca", items.some((i) => i.video.sample)),
    viewer.staff && !sections.shorties ? `${texts.shortiesTitle} está apagado en ${LIBRARY_ADMIN_NAME}: solo lo ve el equipo.` : null,
  ].filter(Boolean);

  return (
    <main className="bib-shorts">
      <ShortiesFeed
        // Other filters, another feed: a chip changes the list in place.
        key={[topic?.key, person?.slug, query, newest].join("|")}
        items={items}
        filters={filters}
        row={feedRow(
          byPerson.map((i) => i.video),
          topic?.key ?? null,
        )}
        themes={LIBRARY_THEMES.flatMap((t) => topics.filter((x) => x.key === t.key))}
        people={people}
        listHref={listHref}
        texts={{
          title: texts.shortiesTitle,
          subtitle: texts.shortiesSubtitle,
          hint: texts.shortiesHint,
          sound: texts.shortiesSound,
          profile: texts.shortiesProfile,
          used: texts.shortiesUsed,
          steps: texts.shortiesSteps,
          share: texts.shortiesShare,
          stepsLink: texts.shortiesStepsLink,
          endTitle: texts.shortiesEndTitle,
          endText: texts.shortiesEndText,
          endAgain: texts.shortiesEndAgain,
          endLibrary: texts.shortiesEndLibrary,
          empty: texts.shortiesEmpty,
          signupTitle: texts.shortiesSignupTitle,
          signupText: texts.shortiesSignupText,
          signupButton: texts.shortiesSignupButton,
          signupLater: texts.shortiesSignupLater,
          seal: texts.sealLabel,
          locked: texts.lockedLabel,
          lockedButton: texts.signupButton,
          usedTitle: texts.usedTitle,
          usedSubtitle: texts.usedSubtitle,
          buy: texts.buyButton,
        }}
        menu={menu}
        titleClass={fraunces.className}
        signupEvery={sections.shortiesSignup && viewer.asksSignup ? SHORTIES_SIGNUP_EVERY : null}
        unlocked={viewer.unlocked}
        profiles={viewer.staff || viewer.config.instructorsPublished}
        showUsed={sections.used}
        showSteps={sections.steps}
        staffNote={notes.length ? notes.join(" ") : null}
      />
      <PreviewToast />
    </main>
  );
}
