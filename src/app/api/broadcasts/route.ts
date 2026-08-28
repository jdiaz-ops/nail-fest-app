import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { hasActiveConsent } from "@/lib/consent";
import { emailProvider } from "@/lib/email";
import { broadcastEmail } from "@/lib/email/templates";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

// KNOWN LIMITATION (flagged, not hidden): this sends synchronously inside
// one request, in small concurrency-limited batches. Fine for testing
// against a modest list. Before sending to a full 10k+ event segment,
// move this loop to a background job/queue (same reasoning as the Meta
// CAPI batching note in the brief review) — the code is structured so
// that swap only touches this route, not the segment/email/consent logic.

const conditionSchema = z.union([
  z.object({ field: z.literal("event"), eventSlug: z.string() }),
  z.object({ field: z.literal("city"), city: z.string() }),
  z.object({ field: z.literal("profession"), profession: z.string() }),
]);

const bodySchema = z.object({
  name: z.string().min(1),
  filter: z.object({
    include: z.array(conditionSchema),
    exclude: z.array(conditionSchema),
  }),
  subject: z.string().min(1),
  bodyText: z.string().min(1),
});

const CONCURRENCY = 10;

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, filter, subject, bodyText } = parsed.data;

  const segment = await db.segmentDefinition.create({ data: { name, filter } });
  const broadcast = await db.emailBroadcast.create({
    data: { segmentId: segment.id, subject, bodyText, status: "SENDING" },
  });

  const people = await resolveSegment(filter as SegmentFilter);

  let sent = 0;
  let skippedNoConsent = 0;
  for (let i = 0; i < people.length; i += CONCURRENCY) {
    const chunk = people.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async (person) => {
        if (!(await hasActiveConsent(person.id, "MARKETING"))) {
          skippedNoConsent++;
          return;
        }
        const unsubscribeUrl = buildUnsubscribeUrl(person.id);
        const content = broadcastEmail({
          firstName: person.firstName ?? "",
          subject,
          bodyText,
          unsubscribeUrl,
        });
        try {
          const result = await emailProvider.sendMarketing({
            to: person.email,
            subject: content.subject,
            text: content.text,
            html: content.html,
            listUnsubscribeHeader: `<${unsubscribeUrl}>`,
          });
          await db.emailLog.create({
            data: {
              kind: "MARKETING",
              broadcastId: broadcast.id,
              personId: person.id,
              toEmail: person.email,
              sesMessageId: result.providerMessageId,
              status: "SENT",
            },
          });
          sent++;
        } catch (err) {
          await db.emailLog.create({
            data: {
              kind: "MARKETING",
              broadcastId: broadcast.id,
              personId: person.id,
              toEmail: person.email,
              status: "FAILED",
            },
          });
          console.error("broadcast send failed", person.email, err);
        }
      })
    );
  }

  await db.emailBroadcast.update({
    where: { id: broadcast.id },
    data: { status: "SENT", sentAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    broadcastId: broadcast.id,
    segmentSize: people.length,
    sent,
    skippedNoConsent,
  });
}

export async function GET() {
  const broadcasts = await db.emailBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { segment: true, _count: { select: { logs: true } } },
  });
  return NextResponse.json({ broadcasts });
}
