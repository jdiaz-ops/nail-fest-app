import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// Deletes the broadcast row and its message log (WhatChimp's own trash
// icon on a campaign row) — never touches WhatsAppTemplate or the
// segment, only this broadcast's own history.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  await db.whatsAppMessage.deleteMany({ where: { broadcastId: params.id } });
  await db.whatsAppBroadcast.delete({ where: { id: params.id } }).catch(() => null);

  return NextResponse.json({ ok: true });
}
