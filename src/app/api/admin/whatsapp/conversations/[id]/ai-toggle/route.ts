import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

const bodySchema = z.object({ enabled: z.boolean() });

// Manual override for WhatsAppConversation.aiAutoReplyEnabled — lets a
// staff member take a conversation back from the AI agent at any point
// (or hand it back once they're done), independent of the agent's own
// escalate_to_human tool and the auto-disable-on-manual-reply behavior in
// the reply route. All three paths write the same field.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  await db.whatsAppConversation.update({ where: { id: params.id }, data: { aiAutoReplyEnabled: parsed.data.enabled } });
  return NextResponse.json({ ok: true });
}
