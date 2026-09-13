import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// How many person ids one Label.update's `connect` call takes at once —
// same reasoning as lib/broadcasts.ts's own CHUNK_SIZE: a real Nail Fest
// segment runs in the thousands, and one query trying to connect all of
// them at once is worth avoiding even though Prisma could technically do
// it in one call.
const CONNECT_CHUNK_SIZE = 500;

async function connectPeopleToLabel(labelId: string, personIds: string[]) {
  for (let i = 0; i < personIds.length; i += CONNECT_CHUNK_SIZE) {
    const chunk = personIds.slice(i, i + CONNECT_CHUNK_SIZE);
    await db.label.update({
      where: { id: labelId },
      data: { people: { connect: chunk.map((id) => ({ id })) } },
    });
  }
}

// Turns "quién abrió este correo" into something the existing segment
// builder can target directly — labels a person "Abrió" or "No abrió"
// for THIS broadcast specifically, using the Label model + its
// already-supported `label` include/exclude segment condition
// (SegmentComposer.tsx), rather than inventing a new condition type. An
// admin triggers this manually (not on a timer) a few days after
// sending, once opens have mostly settled — see the button on
// /admin/crm/broadcasts/[id].
//
// Idempotent: connecting an already-connected Person↔Label pair is a
// no-op (the join table's own composite key), so tapping the button
// twice — say, once at day 3 and again at day 7 to catch late opens —
// only ever grows each bucket, never duplicates anything.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const broadcast = await db.emailBroadcast.findUnique({ where: { id: params.id } });
  if (!broadcast) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const logs = await db.emailLog.findMany({
    where: { broadcastId: broadcast.id, personId: { not: null }, status: { not: "FAILED" } },
    select: { personId: true, openedAt: true, bouncedAt: true, complainedAt: true },
  });

  const openedIds: string[] = [];
  const notOpenedIds: string[] = [];
  for (const log of logs) {
    if (!log.personId) continue;
    if (log.openedAt) {
      openedIds.push(log.personId);
    } else if (!log.bouncedAt && !log.complainedAt) {
      // Never opened, but also never bounced/complained — the real "sent
      // fine, but silent" signal. A bounced/complained recipient is
      // excluded here on purpose: they're already out of future sends
      // via consent revocation (see lib/email/tracking.ts), and lumping
      // them into "no abrió" would muddy that label's meaning (it's
      // meant to answer "reached them but didn't land", not "couldn't
      // reach them at all").
      notOpenedIds.push(log.personId);
    }
  }

  // Suffix with the broadcast id (short) so two broadcasts that happen to
  // share a subject line never collide on Label.name's own @unique.
  const idSuffix = broadcast.id.slice(-6);
  const openedLabelName = `Abrió — ${broadcast.subject} (${idSuffix})`;
  const notOpenedLabelName = `No abrió — ${broadcast.subject} (${idSuffix})`;

  const [openedLabel, notOpenedLabel] = await Promise.all([
    db.label.upsert({ where: { name: openedLabelName }, create: { name: openedLabelName }, update: {} }),
    db.label.upsert({ where: { name: notOpenedLabelName }, create: { name: notOpenedLabelName }, update: {} }),
  ]);

  await Promise.all([connectPeopleToLabel(openedLabel.id, openedIds), connectPeopleToLabel(notOpenedLabel.id, notOpenedIds)]);

  return NextResponse.json({
    ok: true,
    opened: { label: openedLabelName, count: openedIds.length },
    notOpened: { label: notOpenedLabelName, count: notOpenedIds.length },
  });
}
