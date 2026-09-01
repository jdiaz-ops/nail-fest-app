import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// A generic Person edit — not WhatsApp-specific, even though the first
// caller is the Bandeja sidebar (see WhatsAppPersonEditForm.tsx). Person
// is the one row every part of the CRM already reads from at send/sync
// time (broadcasts, segments, Meta Custom Audience hashing) rather than
// a cached copy, so fixing it here is genuinely enough — nothing else
// needs to be told separately. Phone is deliberately NOT editable
// through this route: it's how an inbound WhatsApp message gets matched
// to a Person in the first place (see lib/whatsapp/inbox.ts's
// findPersonByPhone) and changing it here wouldn't even touch the
// WhatsAppConversation.phone this specific thread is keyed on — a
// correction that consequential belongs on a dedicated Personas edit
// screen, not a quick fix from an inbox sidebar.
const bodySchema = z.object({
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().toLowerCase().email().optional(),
  city: z.string().trim().max(120).optional().nullable(),
  profession: z.string().trim().max(120).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await db.person.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.email && parsed.data.email !== existing.email) {
    const conflict = await db.person.findUnique({ where: { email: parsed.data.email } });
    if (conflict && conflict.id !== existing.id) {
      return NextResponse.json({ error: "email_taken", message: "Ya existe otra persona con ese correo." }, { status: 409 });
    }
  }

  const person = await db.person.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ ok: true, person });
}
