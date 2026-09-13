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
export async function POST(_req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const [emailDupes, phoneDupes] = await Promise.all([
    db.$queryRaw<Array<{ email: string; count: bigint }>>(Prisma.sql`
      SELECT email, COUNT(*) AS count FROM "Person" GROUP BY email HAVING COUNT(*) > 1
    `),
    db.$queryRaw<Array<{ phone: string; count: bigint; emails: string[] }>>(Prisma.sql`
      SELECT phone, COUNT(*) AS count, array_agg(email ORDER BY "createdAt") AS emails
      FROM "Person"
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 1000
    `),
  ]);

  return NextResponse.json({
    ok: true,
    emailDuplicateGroups: emailDupes.map((r) => ({ email: r.email, count: Number(r.count) })),
    phoneDuplicateGroups: phoneDupes.map((r) => ({ phone: r.phone, count: Number(r.count), emails: r.emails })),
  });
}
