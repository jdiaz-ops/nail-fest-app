import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// Backs the "Editar detalles" / "Cancelar inscripción" actions in the
// Issued tickets modal (/admin/events/[id]/tickets) — our previous
// ticketing platform's own order modal lets you fix a mistyped
// email/phone and cancel an order;
// this is the same, adapted to our model (no payments, so "cancel" has no
// refund step — it just flips status, same as every other place in this
// app that already treats CANCELLED as "doesn't count", see
// getPublicTicketTypes/EventStatsPanel/EventDecisionStats, all of which
// already filter on status: "CONFIRMED" and so already exclude a
// cancelled row from capacity, stats, and check-in eligibility with zero
// changes needed there).
const patchSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  city: z.string().optional(),
  profession: z.string().optional(),
  // Partial merge, not a full replace — editing one custom field (say,
  // fixing a typo'd cédula) must never silently wipe every other answer
  // this person gave on the checkout form.
  customFields: z.record(z.string()).optional(),
  status: z.enum(["CONFIRMED", "CANCELLED"]).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  const registration = await db.registration.findUnique({ where: { id: params.id }, include: { person: true } });
  if (!registration) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (data.email && data.email.toLowerCase() !== registration.person.email) {
    // Person.email is unique — this is the one field that can genuinely
    // collide with a DIFFERENT real person's account, unlike everything
    // else here. Surface that plainly instead of a raw 500.
    const clash = await db.person.findUnique({ where: { email: data.email.toLowerCase() } });
    if (clash && clash.id !== registration.personId) {
      return NextResponse.json({ error: "email_taken", message: "Ese correo ya pertenece a otra persona en el sistema." }, { status: 409 });
    }
  }

  const personUpdate: Record<string, unknown> = {};
  if (data.firstName !== undefined) personUpdate.firstName = data.firstName;
  if (data.lastName !== undefined) personUpdate.lastName = data.lastName || null;
  if (data.email !== undefined) personUpdate.email = data.email.toLowerCase();
  if (data.phone !== undefined) personUpdate.phone = data.phone;
  if (data.city !== undefined) personUpdate.city = data.city || null;
  if (data.profession !== undefined) personUpdate.profession = data.profession || null;
  if (Object.keys(personUpdate).length > 0) {
    await db.person.update({ where: { id: registration.personId }, data: personUpdate });
  }

  const registrationUpdate: Record<string, unknown> = {};
  if (data.status !== undefined) registrationUpdate.status = data.status;
  if (data.customFields !== undefined) {
    const existing = (registration.customFields as Record<string, string> | null) ?? {};
    registrationUpdate.customFields = { ...existing, ...data.customFields };
  }
  if (Object.keys(registrationUpdate).length > 0) {
    await db.registration.update({ where: { id: params.id }, data: registrationUpdate });
  }

  return NextResponse.json({ ok: true });
}
