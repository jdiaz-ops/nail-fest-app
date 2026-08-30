import { db } from "@/lib/db";
import type { Event } from "@prisma/client";

/**
 * The event the nailfest.co homepage's hero highlights — computed live,
 * never admin-authored (see OrgSettings.homepageImageUrl's own schema
 * comment on why): the published event with the soonest future startsAt.
 * Null when nothing upcoming is published yet — the homepage has its own
 * real fallback copy for that, not a silent blank/broken state.
 */
export async function getNextEvent(): Promise<Event | null> {
  return db.event.findFirst({
    where: { status: "PUBLISHED", startsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });
}
