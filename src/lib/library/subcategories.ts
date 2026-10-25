import { z } from "zod";
import { db } from "@/lib/db";
import { EXTRA_THEMES_UP_TO, LIBRARY_THEMES, themesOf, topicKey } from "./shared";

// Subcategories inside a theme (Navidad, Halloween…), the team's side
// (Editar biblioteca → Videos): make one, rename it — to a name another one
// has and they become one —, move it to another theme, hide it (the library
// stops showing it and the autopilot stops using it) or delete it (its
// videos just stay without it). The autopilot's side is in
// youtubeAutopilot.ts (resolveSubcategory).

const themeKeys = LIBRARY_THEMES.map((t) => t.key) as [string, ...string[]];

export const subcategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(40),
  theme: z.enum(themeKeys),
});

export const subcategoryPatchSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  theme: z.enum(themeKeys).optional(),
  hidden: z.boolean().optional(),
});

/** A new one from the team — or the one there is with that name. */
export async function createSubcategory(input: z.infer<typeof subcategoryInputSchema>) {
  const key = topicKey(input.name);
  if (key.length < 2) throw new Error("invalid_name");
  const existing = await db.librarySubcategory.findUnique({ where: { key } });
  if (existing) return existing;
  return db.librarySubcategory.create({ data: { key, name: input.name, theme: input.theme, createdBy: "equipo" } });
}

/** Its videos get its theme among theirs, when they have room for it. */
async function giveVideosTheTheme(key: string, theme: string) {
  const videos = await db.libraryVideo.findMany({ where: { subcategories: { has: key } }, select: { id: true, theme: true, extraThemes: true } });
  for (const video of videos) {
    if (themesOf(video).some((t) => t === theme) || video.extraThemes.length >= EXTRA_THEMES_UP_TO) continue;
    await db.libraryVideo.update({ where: { id: video.id }, data: { extraThemes: [...video.extraThemes, theme] } });
  }
}

/** Renamed, moved or hidden. A name another one has: this one joins it. */
export async function updateSubcategory(id: string, patch: z.infer<typeof subcategoryPatchSchema>): Promise<{ mergedInto: string | null } | null> {
  const sub = await db.librarySubcategory.findUnique({ where: { id } });
  if (!sub) return null;
  if (patch.name !== undefined) {
    const key = topicKey(patch.name);
    if (key.length < 2) throw new Error("invalid_name");
    const other = key === sub.key ? null : await db.librarySubcategory.findUnique({ where: { key } });
    if (other) {
      await db.$transaction([
        db.$executeRaw`UPDATE "LibraryVideo" SET "subcategories" = array_replace("subcategories", ${sub.key}, ${other.key}) WHERE ${sub.key} = ANY("subcategories")`,
        db.librarySubcategory.delete({ where: { id: sub.id } }),
      ]);
      return { mergedInto: other.name };
    }
    await db.$transaction([
      db.librarySubcategory.update({ where: { id: sub.id }, data: { key, name: patch.name } }),
      db.$executeRaw`UPDATE "LibraryVideo" SET "subcategories" = array_replace("subcategories", ${sub.key}, ${key}) WHERE ${sub.key} = ANY("subcategories")`,
    ]);
    sub.key = key;
  }
  if (patch.theme !== undefined || patch.hidden !== undefined) {
    await db.librarySubcategory.update({ where: { id: sub.id }, data: { theme: patch.theme, hidden: patch.hidden } });
  }
  if (patch.theme !== undefined && patch.theme !== sub.theme) await giveVideosTheTheme(sub.key, patch.theme);
  return { mergedInto: null };
}

/** Deleted: its videos stay, without it. */
export async function deleteSubcategory(id: string): Promise<boolean> {
  const sub = await db.librarySubcategory.findUnique({ where: { id } });
  if (!sub) return false;
  await db.$transaction([
    db.$executeRaw`UPDATE "LibraryVideo" SET "subcategories" = array_remove("subcategories", ${sub.key}) WHERE ${sub.key} = ANY("subcategories")`,
    db.librarySubcategory.delete({ where: { id: sub.id } }),
  ]);
  return true;
}
