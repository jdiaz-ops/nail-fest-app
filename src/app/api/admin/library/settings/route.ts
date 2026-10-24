import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { updateLibrarySettings } from "@/lib/library/settings";
import { LIBRARY_SECTION_KEYS, LIBRARY_TEXT_KEYS } from "@/lib/library/texts";

const patchSchema = z
  .object({
    published: z.boolean(),
    instructorsPublished: z.boolean(),
    // Only real keys; an empty text goes back to the usual one.
    texts: z.record(z.string(), z.string().max(400)).transform((map) =>
      Object.fromEntries(
        Object.entries(map)
          .filter(([key]) => (LIBRARY_TEXT_KEYS as string[]).includes(key))
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value),
      ),
    ),
    sections: z
      .record(z.string(), z.boolean())
      .transform((map) => Object.fromEntries(Object.entries(map).filter(([key]) => (LIBRARY_SECTION_KEYS as string[]).includes(key)))),
    popularSearches: z
      .array(z.string().trim().min(1).max(40))
      .max(8)
      .transform((list) => [...new Set(list)]),
  })
  .partial();

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const settings = await updateLibrarySettings(parsed.data);
  return NextResponse.json({ ok: true, settings });
}
