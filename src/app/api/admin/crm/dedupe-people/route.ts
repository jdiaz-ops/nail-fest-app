import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { planAllMerges, type DedupePersonRow } from "@/lib/dedupe/personDedupe";

// Answers "exactly how many unique people do I have" precisely, by
// turning the phone-duplicate signal into an actual (conservative)
// decision — see personDedupe.ts's own comment for the exact matching
// rules. Two modes on the same computation:
//   - apply=false (default): dry run, nothing written, just the plan.
//   - apply=true: writes mergedIntoId/mergedAt/mergeReason on the
//     non-canonical rows of every FULLY-RESOLVED cluster. Never deletes
//     a row, never touches any other table — every existing relation
//     (registrations, consents, EmailLog, WhatsApp, labels) keeps
//     pointing exactly where it already pointed.
const REVIEW_LIST_LIMIT = 200;
const CHUNK_SIZE = 500;
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const apply = body?.apply === true;

  const rows = await db.$queryRaw<
    Array<{ id: string; phone: string; email: string; firstName: string | null; lastName: string | null; createdAt: Date }>
  >(Prisma.sql`
    SELECT id, phone, email, "firstName", "lastName", "createdAt"
    FROM "Person"
    WHERE phone IN (
      SELECT phone FROM "Person"
      WHERE phone IS NOT NULL AND phone != '' AND "mergedIntoId" IS NULL
      GROUP BY phone
      HAVING COUNT(*) > 1
    )
    AND "mergedIntoId" IS NULL
    ORDER BY phone, "createdAt" ASC
  `);

  const groups = new Map<string, DedupePersonRow[]>();
  for (const r of rows) {
    if (!groups.has(r.phone)) groups.set(r.phone, []);
    groups.get(r.phone)!.push(r);
  }

  const plan = planAllMerges(groups);
  const extraProfilesResolved = plan.merges.length;

  if (apply && plan.merges.length > 0) {
    const now = new Date();
    for (let i = 0; i < plan.merges.length; i += CHUNK_SIZE) {
      const chunk = plan.merges.slice(i, i + CHUNK_SIZE);
      await db.$transaction(
        chunk.map((m) =>
          db.person.update({
            where: { id: m.mergedId },
            data: { mergedIntoId: m.canonicalId, mergedAt: now, mergeReason: m.reason },
          })
        )
      );
    }
  }

  return NextResponse.json({
    ok: true,
    applied: apply,
    totalGroupsScanned: groups.size,
    autoMergedGroups: plan.autoMergedGroups,
    autoMergedExtraProfiles: extraProfilesResolved,
    needsReviewGroups: plan.needsReview.length,
    needsReviewPreview: plan.needsReview.slice(0, REVIEW_LIST_LIMIT).map((g) => ({
      phone: g.phone,
      people: g.people.map((p) => ({ email: p.email, firstName: p.firstName, lastName: p.lastName })),
    })),
    needsReviewTruncated: plan.needsReview.length > REVIEW_LIST_LIMIT,
  });
}
