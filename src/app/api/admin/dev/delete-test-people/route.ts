import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// One-off cleanup for confirmed test/junk Person rows (typo'd emails
// entered while testing the registration form's typo-suggestion
// feature) — NOT a general suppression tool. Unlike everything in the
// now-removed Higiene/Etiquetar/Supresiones trio, this actually DELETES
// the Person row and its data, permanently. That's safe here only
// because it's scoped to an explicit, human-provided list of exact
// emails (never a heuristic guess at "this looks fake") and always
// previewed (apply=false) before a real delete (apply=true).
//
// Person has no ON DELETE CASCADE from Registration/Consent (both
// required FKs, default RESTRICT) — deleting those children first, in
// dependency order, is what makes `db.person.delete` succeed at all.
// WhatsAppConversation cascades its own Messages/Notes already (schema-
// level onDelete: Cascade), so deleting the conversation row is enough.
// EmailLog.personId is a bare column (no FK relation) — cleaned up here
// too for tidiness, not because anything requires it.
const CHUNK_SIZE = 500;

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const rawEmails: unknown = body?.emails;
  const apply = body?.apply === true;
  if (!Array.isArray(rawEmails)) {
    return NextResponse.json({ error: "missing_emails" }, { status: 400 });
  }

  const emails = [...new Set(rawEmails.filter((e): e is string => typeof e === "string").map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (emails.length === 0) {
    return NextResponse.json({ error: "no_valid_emails" }, { status: 400 });
  }

  const people = await db.person.findMany({
    where: { email: { in: emails } },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      _count: { select: { registrations: true, consents: true, whatsappConversations: true } },
    },
  });

  const found = new Set(people.map((p) => p.email));
  const notFound = emails.filter((e) => !found.has(e));

  if (apply) {
    for (let i = 0; i < people.length; i += CHUNK_SIZE) {
      const chunk = people.slice(i, i + CHUNK_SIZE).map((p) => p.id);
      await db.$transaction([
        db.consent.deleteMany({ where: { personId: { in: chunk } } }),
        db.payment.deleteMany({ where: { registration: { personId: { in: chunk } } } }),
        db.registration.deleteMany({ where: { personId: { in: chunk } } }),
        db.whatsAppConversation.deleteMany({ where: { personId: { in: chunk } } }),
        db.emailLog.deleteMany({ where: { personId: { in: chunk } } }),
        db.person.deleteMany({ where: { id: { in: chunk } } }),
      ]);
    }
  }

  return NextResponse.json({
    ok: true,
    applied: apply,
    matched: people.map((p) => ({
      email: p.email,
      name: [p.firstName, p.lastName].filter(Boolean).join(" ") || null,
      createdAt: p.createdAt,
      registrations: p._count.registrations,
      consents: p._count.consents,
      whatsappConversations: p._count.whatsappConversations,
    })),
    notFound,
  });
}
