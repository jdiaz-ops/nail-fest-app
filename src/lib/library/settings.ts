import type { LibrarySettings, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DEFAULT_POPULAR_SEARCHES, resolveSections, resolveTexts, type LibrarySections, type LibraryTexts } from "./texts";

export const LIBRARY_SETTINGS_ID = "singleton";

// What a fresh install reads before anyone saves anything — the same "a
// missing row is just the defaults" reasoning as getCuponeraSettings().
// Reading never writes; the row is created on the first save.
const DEFAULTS: LibrarySettings = {
  id: LIBRARY_SETTINGS_ID,
  published: false,
  instructorsPublished: false,
  portalOpen: false,
  texts: {},
  sections: {},
  popularSearches: DEFAULT_POPULAR_SEARCHES,
  updatedAt: new Date(0),
};

export async function getLibrarySettings(): Promise<LibrarySettings> {
  return (await db.librarySettings.findUnique({ where: { id: LIBRARY_SETTINGS_ID } })) ?? DEFAULTS;
}

export interface LibraryConfig {
  published: boolean;
  instructorsPublished: boolean;
  /** Anyone can make a profile at /instructoras/unirme. */
  portalOpen: boolean;
  texts: LibraryTexts;
  sections: LibrarySections;
  popularSearches: string[];
}

export function libraryConfigOf(settings: LibrarySettings): LibraryConfig {
  return {
    published: settings.published,
    instructorsPublished: settings.instructorsPublished,
    portalOpen: settings.portalOpen,
    texts: resolveTexts(settings.texts),
    sections: resolveSections(settings.sections),
    popularSearches: settings.popularSearches,
  };
}

export type LibrarySettingsPatch = Partial<{
  published: boolean;
  instructorsPublished: boolean;
  portalOpen: boolean;
  texts: Record<string, string>;
  sections: Record<string, boolean>;
  popularSearches: string[];
}>;

export async function updateLibrarySettings(patch: LibrarySettingsPatch): Promise<LibrarySettings> {
  const data: Prisma.LibrarySettingsUpdateInput = {
    ...patch,
    ...(patch.texts ? { texts: patch.texts as Prisma.InputJsonValue } : {}),
    ...(patch.sections ? { sections: patch.sections as Prisma.InputJsonValue } : {}),
  };
  return db.librarySettings.upsert({
    where: { id: LIBRARY_SETTINGS_ID },
    update: data,
    create: { popularSearches: DEFAULT_POPULAR_SEARCHES, ...(data as Omit<Prisma.LibrarySettingsCreateInput, "id">), id: LIBRARY_SETTINGS_ID },
  });
}
