import { NextResponse } from "next/server";
import { ensureSeedAudiences } from "@/lib/meta/audiences";
import { requireUser } from "@/lib/auth/guard";

// Creates the three seed audiences from the brief if they don't already
// exist by name — safe to call more than once, it looks them up first.
export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  try {
    const result = await ensureSeedAudiences();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
