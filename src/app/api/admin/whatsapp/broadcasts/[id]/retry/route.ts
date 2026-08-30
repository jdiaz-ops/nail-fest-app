import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { retryFailedMessages } from "@/lib/whatsapp/broadcasts";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  try {
    const result = await retryFailedMessages(params.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("whatsapp broadcast retry failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "retry_failed" }, { status: 502 });
  }
}
