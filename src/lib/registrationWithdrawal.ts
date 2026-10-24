import { db } from "@/lib/db";
import type { Prisma, RegistrationStatus } from "@prisma/client";
import { formatDateInTz } from "@/lib/dateFormat";

// "No puedo ir" (2026-10-24): someone writes — WhatsApp, email — that they
// won't make it, and the team takes them out of that edition in one tap,
// from the Bandeja's Entradas or the contact's page. It's the existing
// cancellation (status CANCELLED), which every send, every stat and the
// capacity count already leave out (see api/admin/registrations/[id]'s
// own comment), plus who and when, so it shows and can be undone.
// Nothing is sent to them, their consents stay as they are (they still
// hear about the next edition), and if they come after all the door still
// scans them in — and that puts them back (lib/scan.ts).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whether an event hasn't finished: until its endsAt, or a day after it
 * starts when it has none. */
export function eventStillAhead(event: { startsAt: Date; endsAt: Date | null }, now: Date = new Date()): boolean {
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + DAY_MS);
  return end.getTime() > now.getTime();
}

/** "in": confirmed, not at the door yet — can be taken out. "out": taken
 * out, with who and when — can be put back. */
export type EditionState = "in" | "out";

export interface EditionRegistration {
  status: RegistrationStatus;
  checkedInCount: number;
  cancelledAt: Date | null;
  event: { startsAt: Date; endsAt: Date | null };
}

/** null: nothing to do here — the event is over, they already came in, the
 * registration was never finished, or it was cancelled before who and
 * when were kept (Entradas emitidas still reactivates those). */
export function editionState(r: EditionRegistration, now: Date = new Date()): EditionState | null {
  if (!eventStillAhead(r.event, now)) return null;
  if (r.status === "CONFIRMED") return r.checkedInCount === 0 ? "in" : null;
  if (r.status === "CANCELLED" && r.cancelledAt) return "out";
  return null;
}

/** Why a registration can't be taken out (or put back), in words. */
function whyNot(r: EditionRegistration, now: Date): string {
  if (!eventStillAhead(r.event, now)) return "Este evento ya pasó.";
  if (r.status === "CONFIRMED") return "Ya entró al evento: no se puede retirar.";
  if (r.status === "CANCELLED") return "Esta inscripción se canceló antes; se reactiva desde Entradas emitidas.";
  return "Esta inscripción no está confirmada.";
}

export class WithdrawalError extends Error {}

const include = { event: true, cancelledBy: { select: { name: true, username: true } } } as const;

/** Takes them out of this edition — see the top of this file. A second
 * tap (another tab, a teammate) finds them already out and leaves it so:
 * `changed` says whether this one did it. */
export async function withdrawRegistration(registrationId: string, adminUserId: string, now: Date = new Date()) {
  const registration = await db.registration.findUnique({ where: { id: registrationId }, include });
  if (!registration) throw new WithdrawalError("No se encontró esa inscripción.");
  const state = editionState(registration, now);
  if (state === "out") return { registration, changed: false };
  if (state !== "in") throw new WithdrawalError(whyNot(registration, now));
  // Conditional, so a scan landing in between wins: someone already at
  // the door is not taken out.
  const { count } = await db.registration.updateMany({
    where: { id: registrationId, status: "CONFIRMED", checkedInCount: 0 },
    data: { status: "CANCELLED", cancelledAt: now, cancelledById: adminUserId },
  });
  if (count === 0) throw new WithdrawalError("Ya entró al evento: no se puede retirar.");
  return { registration: await db.registration.findUniqueOrThrow({ where: { id: registrationId }, include }), changed: true };
}

/** Undoes withdrawRegistration: confirmed again, with the same tickets. */
export async function restoreRegistration(registrationId: string, now: Date = new Date()) {
  const registration = await db.registration.findUnique({ where: { id: registrationId }, include });
  if (!registration) throw new WithdrawalError("No se encontró esa inscripción.");
  const state = editionState(registration, now);
  if (state === "in") return { registration, changed: false };
  if (state !== "out") throw new WithdrawalError(whyNot(registration, now));
  const restored = await db.registration.update({
    where: { id: registrationId },
    data: { status: "CONFIRMED", cancelledAt: null, cancelledById: null, confirmedAt: registration.confirmedAt ?? now },
    include,
  });
  return { registration: restored, changed: true };
}

/** The registrations of events still ahead that can be taken out or put
 * back, newest first — the Bandeja's Entradas (whoever the chat belongs
 * to, see chatRegistrationOwners) and the contact's page. */
export async function listEditionRegistrations(owners: Prisma.RegistrationWhereInput[], now: Date = new Date()) {
  if (owners.length === 0) return [];
  const rows = await db.registration.findMany({
    where: {
      OR: owners,
      status: { in: ["CONFIRMED", "CANCELLED"] },
      event: { OR: [{ endsAt: { gt: now } }, { endsAt: null, startsAt: { gt: new Date(now.getTime() - DAY_MS) } }] },
    },
    include: { ...include, person: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return rows.flatMap((r) => {
    const state = editionState(r, now);
    return state ? [{ ...r, state }] : [];
  });
}

/** "Juan · 24 oct": who took them out and when, for the "out" line. */
export function withdrawnByLine(
  r: { cancelledAt: Date | null; cancelledBy: { name: string | null; username: string } | null },
  timezone: string,
  language: string
): string | null {
  if (!r.cancelledAt) return null;
  const day = formatDateInTz(r.cancelledAt, { day: "numeric", month: "short" }, timezone, language);
  const who = r.cancelledBy ? r.cancelledBy.name || r.cancelledBy.username : null;
  return [who, day].filter(Boolean).join(" · ");
}
