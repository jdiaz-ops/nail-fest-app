import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PreviewToast from "@/components/cuponera/PreviewToast";
import { libraryStaffNote } from "@/components/library/LibraryShell";
import ShortiesFeed from "@/components/library/ShortiesFeed";
import { getLibraryViewer, getShorties, libraryRobots } from "@/lib/library/data";
import { getSiteMenu } from "@/lib/community/home";
import { SHORTIES_SIGNUP_EVERY, hasTopic, shortiesOrder, topicKey, topicsOf } from "@/lib/library/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

/** ?tema=polygel — a theme's key or a tag's ("Nail art" → nail-art). */
function topicParam(searchParams: SearchParams): string | null {
  const value = searchParams.tema;
  const key = typeof value === "string" ? topicKey(value) : "";
  return key && key.length <= 60 ? key : null;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const viewer = await getLibraryViewer();
  const key = topicParam(searchParams);
  const topic = key ? topicsOf((await getShorties(viewer)).map((i) => i.video)).find((t) => t.key === key) : undefined;
  const title = viewer.config.texts.shortiesTitle;
  return {
    title: `${topic ? `${title} de ${topic.label}` : title} · Biblioteca Nail Fest`,
    description: topic ? `Videos cortos de ${topic.label}, uno tras otro.` : "Videos cortos de las instructoras Nail Fest, uno tras otro.",
    robots: await libraryRobots("biblioteca"),
  };
}

// nailfest.lat/biblioteca/cortos ("Shorties" until 2026-10-24) — the short
// videos one after another, full screen, in a new order every visit (?v=
// puts a shared one first). ?tema= keeps only one topic's: a theme
// (?tema=tecnicas) or a tag (?tema=polygel), the chips on each video.
// Switched off in Editar biblioteca, visitors get "page not found".
export default async function CortosPage({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await getLibraryViewer();
  const { texts, sections } = viewer.config;
  if ((!viewer.config.published || !sections.shorties) && !viewer.staff) notFound();
  const [all, menu] = await Promise.all([getShorties(viewer), getSiteMenu(viewer)]);
  const first = typeof searchParams.v === "string" ? searchParams.v : null;
  const key = topicParam(searchParams);
  const topic = key ? (topicsOf(all.map((i) => i.video)).find((t) => t.key === key) ?? { key, label: key.replace(/-/g, " "), count: 0 }) : null;
  const items = topic ? all.filter((i) => hasTopic(i.video, topic.key)) : all;
  const notes = [
    libraryStaffNote(viewer, "biblioteca", items.some((i) => i.video.sample)),
    viewer.staff && !sections.shorties ? `${texts.shortiesTitle} está apagado en Editar biblioteca: solo lo ve el equipo.` : null,
  ].filter(Boolean);

  return (
    <main className="bib-shorts">
      <ShortiesFeed
        // A new topic is a new feed: tapping a chip changes the list in place.
        key={topic?.key ?? "todos"}
        items={shortiesOrder(items, first)}
        topic={topic ? { key: topic.key, label: topic.label } : null}
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
