import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { syncTemplates } from "@/lib/whatsapp/templates";

export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  try {
    const result = await syncTemplates();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("whatsapp template sync failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "sync_failed" }, { status: 502 });
  }
}
