import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { sanitizeLandingBlocks, slugify } from "@/lib/events";
import type { LandingBlock } from "@/lib/landingBlocks/types";
import { landingBlockSchema } from "@/lib/landingBlocks/schema";

// Static routes that already live under /[eventSlug]/ — a page can't take
// one of these as its slug or it would never be reachable.
const RESERVED_SLUGS = new Set(["pago"]);

// What /api/admin/pages (POST) and /api/admin/pages/[id] (PUT) accept —
// a page is always saved whole.
export const infoPageSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().min(1),
  slug: z.string().optional(),
  intro: z.string().default(""),
  blocks: z.array(landingBlockSchema).default([]),
  published: z.boolean().default(false),
  showRegisterButton: z.boolean().default(true),
});

export interface InfoPageInput {
  eventId: string;
  title: string;
  slug?: string;
  intro: string;
  blocks: LandingBlock[];
  published: boolean;
  showRegisterButton: boolean;
}

/** The slug the page will get: what the admin typed (or the title), made
 * URL-safe, never a reserved route, and -2, -3… when another page of the
 * same event already has it. */
export async function uniqueInfoPageSlug(eventId: string, wanted: string, excludeId?: string): Promise<string> {
  let root = slugify(wanted) || "pagina";
  if (RESERVED_SLUGS.has(root)) root = `${root}-info`;
  let candidate = root;
  let n = 2;
  while (await db.infoPage.findFirst({ where: { eventId, slug: candidate, id: excludeId ? { not: excludeId } : undefined } })) {
    candidate = `${root}-${n}`;
    n += 1;
  }
  return candidate;
}

export async function createInfoPage(input: InfoPageInput) {
  const slug = await uniqueInfoPageSlug(input.eventId, input.slug || input.title);
  return db.infoPage.create({
    data: {
      eventId: input.eventId,
      slug,
      title: input.title,
      intro: input.intro,
      blocks: sanitizeLandingBlocks(input.blocks) as unknown as Prisma.InputJsonValue,
      published: input.published,
      showRegisterButton: input.showRegisterButton,
    },
  });
}

export async function updateInfoPage(id: string, input: InfoPageInput) {
  const slug = await uniqueInfoPageSlug(input.eventId, input.slug || input.title, id);
  return db.infoPage.update({
    where: { id },
    data: {
      eventId: input.eventId,
      slug,
      title: input.title,
      intro: input.intro,
      blocks: sanitizeLandingBlocks(input.blocks) as unknown as Prisma.InputJsonValue,
      published: input.published,
      showRegisterButton: input.showRegisterButton,
    },
  });
}
