import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { classifyPhoneCountry, type PhoneCountryFixCategory } from "@/lib/phone/phoneCountryFix";

// Confirmed via a real export: a meaningful slice of stored phones carry
// the wrong (or missing, or an extra) country code, not a malformed
// number — see phoneCountryFix.ts's own comment. Scans every Person with
// a phone on file (not gated on WHATSAPP consent — correct contact data
// is worth having regardless of current consent state), classifies each,
// and — apply=true — REPLACES Person.phone for the three categories
// where the fix is unambiguous (missing_57_entirely, wrong_code_extra1,
// wrong_code_swap). Never touches the other categories — those stay
// exactly as stored, reported separately for human review or WhatsApp
// suppression (see suppress-ambiguous-phones).
export const maxDuration = 60;
const CHUNK_SIZE = 500;
const PREVIEW_LIMIT = 300;

const FIXABLE: PhoneCountryFixCategory[] = ["missing_57_entirely", "wrong_code_extra1", "wrong_code_swap"];
const NEEDS_REVIEW: PhoneCountryFixCategory[] = ["missing_57_and_truncated", "co_ambiguous_shape", "ambiguous_other"];

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const apply = body?.apply === true;

  const people = await db.person.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true, firstName: true, lastName: true, email: true },
  });

  const fixes: { id: string; from: string; to: string; category: PhoneCountryFixCategory }[] = [];
  const needsReview: { id: string; phone: string; category: PhoneCountryFixCategory; name: string | null; email: string }[] = [];

  for (const p of people) {
    const result = classifyPhoneCountry(p.phone);
    if (result.category === "clean") continue;
    if (FIXABLE.includes(result.category) && result.correctedPhone) {
      fixes.push({ id: p.id, from: p.phone!, to: result.correctedPhone, category: result.category });
    } else if (NEEDS_REVIEW.includes(result.category)) {
      needsReview.push({
        id: p.id,
        phone: p.phone!,
        category: result.category,
        name: [p.firstName, p.lastName].filter(Boolean).join(" ") || null,
        email: p.email,
      });
    }
  }

  if (apply && fixes.length > 0) {
    for (let i = 0; i < fixes.length; i += CHUNK_SIZE) {
      const chunk = fixes.slice(i, i + CHUNK_SIZE);
      await db.$transaction(chunk.map((f) => db.person.update({ where: { id: f.id }, data: { phone: f.to } })));
    }
  }

  const countByCategory: Record<string, number> = {};
  for (const f of fixes) countByCategory[f.category] = (countByCategory[f.category] ?? 0) + 1;
  for (const r of needsReview) countByCategory[r.category] = (countByCategory[r.category] ?? 0) + 1;

  return NextResponse.json({
    ok: true,
    applied: apply,
    totalChecked: people.length,
    fixableCount: fixes.length,
    needsReviewCount: needsReview.length,
    countByCategory,
    fixPreview: fixes.slice(0, PREVIEW_LIMIT).map((f) => ({ from: f.from, to: f.to, category: f.category })),
    needsReviewPreview: needsReview.slice(0, PREVIEW_LIMIT),
  });
}
