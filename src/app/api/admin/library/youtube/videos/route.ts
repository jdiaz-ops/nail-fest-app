import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { decideSchema, passToLibrary, setAside } from "@/lib/library/youtubeImport";

// What the team decides about the videos brought from YouTube: to the
// library (hidden, by default), set aside, or back to review.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = decideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  const input = parsed.data;
  if (input.action === "pasar") {
    try {
      return NextResponse.json({ ok: true, count: await passToLibrary(input) });
    } catch (error) {
      if (error instanceof Error && error.message === "unknown_instructor") return NextResponse.json({ error: "unknown_instructor" }, { status: 400 });
      throw error;
    }
  }
  return NextResponse.json({ ok: true, count: await setAside(input.ids, input.action === "revisar") });
}
