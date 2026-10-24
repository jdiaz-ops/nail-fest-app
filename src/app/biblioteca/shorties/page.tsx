import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PreviewToast from "@/components/cuponera/PreviewToast";
import { libraryStaffNote } from "@/components/library/LibraryShell";
import ShortiesFeed from "@/components/library/ShortiesFeed";
import { getLibraryMenu, getLibraryViewer, getShorties, libraryRobots } from "@/lib/library/data";
import { SHORTIES_SIGNUP_EVERY, shortiesOrder } from "@/lib/library/shared";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const viewer = await getLibraryViewer();
  return {
    title: `${viewer.config.texts.shortiesTitle} · Biblioteca Nail Fest`,
    description: "Videos cortos de las instructoras Nail Fest, uno tras otro.",
    robots: await libraryRobots("biblioteca"),
  };
}

// nailfest.lat/biblioteca/shorties — the short videos one after another,
// full screen, in a new order every visit (?v= puts a shared one first).
// Switched off in Editar biblioteca, visitors get "page not found".
export default async function ShortiesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const viewer = await getLibraryViewer();
  const { texts, sections } = viewer.config;
  if ((!viewer.config.published || !sections.shorties) && !viewer.staff) notFound();
  const [items, menu] = await Promise.all([getShorties(viewer), getLibraryMenu(viewer)]);
  const first = typeof searchParams.v === "string" ? searchParams.v : null;
  const notes = [
    libraryStaffNote(viewer, "biblioteca", items.some((i) => i.video.sample)),
    viewer.staff && !sections.shorties ? "Shorties está apagado en Editar biblioteca: solo lo ve el equipo." : null,
  ].filter(Boolean);

  return (
    <main className="bib-shorts">
      <ShortiesFeed
        items={shortiesOrder(items, first)}
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
        signupEvery={sections.shortiesSignup && (viewer.staff || !viewer.unlocked) ? SHORTIES_SIGNUP_EVERY : null}
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
