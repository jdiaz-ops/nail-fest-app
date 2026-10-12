import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { saveReviewTextOverrides } from "@/lib/reviewPageTexts";

// The review pages' copy (lib/reviewPageTexts.ts) — the whole override
// map at once, from /admin/resenas/textos.
export async function PUT(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const saved = await saveReviewTextOverrides(body as Record<string, unknown>);
  return NextResponse.json({ ok: true, overrides: saved });
}
