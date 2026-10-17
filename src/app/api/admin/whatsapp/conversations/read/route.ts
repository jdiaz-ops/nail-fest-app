import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

// Marks many conversations read at once — the Bandeja's selection mode
// and its "Marcar todos como leídos". Same effect as opening each one.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const result = await db.whatsAppConversation.updateMany({ where: { id: { in: parsed.data.ids }, unreadCount: { gt: 0 } }, data: { unreadCount: 0 } });
  return NextResponse.json({ ok: true, updated: result.count });
}
