import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// Answers "are these contacts really unique?" two different ways —
// email-string uniqueness is guaranteed by Person.email's own DB-level
// UNIQUE constraint (this query should always come back empty; it exists
// so that's provable, not just asserted), but "unique real humans" is a
// different, real question that email alone can never answer: the same
// person can register twice with two different addresses. Phone is the
// one other identifier collected at registration that ISN'T unique-
// constrained (a shared family phone is legitimate), so the same phone
// on two different Person rows with two different emails is the
// strongest signal this app has for "this might be the same human
// counted twice" — not proof (a shared phone can be entirely legitimate,
// e.g. two people who share a household line), which is why this reports
// the groups for a human to look at rather than silently merging or
// deleting anything.
//
// The phone-group LIST is capped (a real Nail Fest-sized base can have
// thousands of these, too much to render at once) — but the AGGREGATE
// numbers below (totalPhoneGroups, totalExtraProfiles) are computed
// WITHOUT that cap, specifically so hitting the cap on the list never
// silently reads as "that's the whole total".
const PHONE_GROUP_LIST_LIMIT = 200;

export async function POST(_req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const [emailDupes, phoneDupeTotals, phoneDupeList] = await Promise.all([
    db.$queryRaw<Array<{ email: string; count: bigint }>>(Prisma.sql`
      SELECT email, COUNT(*) AS count FROM "Person" GROUP BY email HAVING COUNT(*) > 1
    `),
    // Same GROUP BY as the list query below, but aggregated ONE level
    // further — no per-phone rows, just how many groups exist and how
    // many "extra" profiles they add up to (count - 1 per group: the
    // first profile on a phone isn't a duplicate of anything, every one
    // after it plausibly is).
    db.$queryRaw<Array<{ total_groups: bigint; total_extra: bigint }>>(Prisma.sql`
      SELECT COUNT(*) AS total_groups, COALESCE(SUM(cnt - 1), 0) AS total_extra
      FROM (
        SELECT COUNT(*) AS cnt
        FROM "Person"
        WHERE phone IS NOT NULL AND phone != ''
        GROUP BY phone
        HAVING COUNT(*) > 1
      ) groups
    `),
    db.$queryRaw<Array<{ phone: string; count: bigint; emails: string[] }>>(Prisma.sql`
      SELECT phone, COUNT(*) AS count, array_agg(email ORDER BY "createdAt") AS emails
      FROM "Person"
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT ${PHONE_GROUP_LIST_LIMIT}
    `),
  ]);

  const totals = phoneDupeTotals[0];

  return NextResponse.json({
    ok: true,
    emailDuplicateGroups: emailDupes.map((r) => ({ email: r.email, count: Number(r.count) })),
    totalPhoneGroups: totals ? Number(totals.total_groups) : 0,
    totalExtraProfiles: totals ? Number(totals.total_extra) : 0,
    phoneDuplicateGroups: phoneDupeList.map((r) => ({ phone: r.phone, count: Number(r.count), emails: r.emails })),
    phoneGroupsTruncated: totals ? Number(totals.total_groups) > PHONE_GROUP_LIST_LIMIT : false,
  });
}
