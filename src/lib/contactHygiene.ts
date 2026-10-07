// Automatic list hygiene: the moment a send proves a contact detail dead
// (Meta says the number has no WhatsApp, the mail server says the address
// doesn't exist, the person reports us as spam), the person gets a label
// saying so — visible on their profile, usable in segments — and the
// matching consent is withdrawn so no future send tries them again.
// Before this, the signal existed in the message/email logs and nothing
// acted on it until an admin noticed a high "fallidos" number.

import { db } from "@/lib/db";
import { revokeConsent } from "@/lib/consent";

export const HYGIENE_LABELS = {
  invalidPhone: "celular inválido",
  invalidEmail: "correo inválido",
  spamComplaint: "queja de spam",
  metaBlocked: "frenado por Meta",
} as const;

export type HygieneLabel = (typeof HYGIENE_LABELS)[keyof typeof HYGIENE_LABELS];

async function labelPeople(name: HygieneLabel, personIds: string[]): Promise<void> {
  if (personIds.length === 0) return;
  const label = await db.label.upsert({ where: { name }, update: {}, create: { name } });
  await db.label.update({ where: { id: label.id }, data: { people: { connect: personIds.map((id) => ({ id })) } } });
}

/** Every Person carrying this WhatsApp number (last 10 digits — the same
 * key the rest of the WhatsApp code compares on). A number is shared by
 * duplicate CRM records of one person, and all of them are equally dead. */
async function peopleByPhone(phone: string): Promise<string[]> {
  const last10 = phone.replace(/\D/g, "").slice(-10);
  if (last10.length < 7) return [];
  return (await db.person.findMany({ where: { phone: { endsWith: last10 } }, select: { id: true } })).map((p) => p.id);
}

/** Meta said the number can't receive WhatsApp messages (131026, or an
 * invalid-recipient rejection). Label + withdraw WHATSAPP consent, right
 * away: on a freshly typed number there is nothing ambiguous about it. */
export async function markPhoneInvalid(phone: string): Promise<string[]> {
  const ids = await peopleByPhone(phone);
  await labelPeople(HYGIENE_LABELS.invalidPhone, ids);
  for (const id of ids) await revokeConsent(id, "WHATSAPP", { onlyIfActive: true });
  return ids;
}

/** Meta is shielding this user from marketing right now (131049, 130472).
 * Label only — nothing is wrong with the number, and the next difusión
 * may well reach them. */
export async function markMetaBlocked(phone: string): Promise<string[]> {
  const ids = await peopleByPhone(phone);
  await labelPeople(HYGIENE_LABELS.metaBlocked, ids);
  return ids;
}

/** The address bounced hard or the provider refused it as invalid. Label +
 * withdraw MARKETING consent (LOGISTICS stays: their ticket still has to
 * reach them if the address gets corrected). */
export async function markEmailInvalid(personId: string): Promise<void> {
  await labelPeople(HYGIENE_LABELS.invalidEmail, [personId]);
  await revokeConsent(personId, "MARKETING", { onlyIfActive: true });
}

export async function markSpamComplaint(personId: string): Promise<void> {
  await labelPeople(HYGIENE_LABELS.spamComplaint, [personId]);
  await revokeConsent(personId, "MARKETING", { onlyIfActive: true });
}

/** How many people carry each hygiene label — the Monday briefing's one
 * line on list health, and the Limpieza page's headline. */
export async function hygieneSummary(): Promise<{ label: HygieneLabel; count: number }[]> {
  const labels = await db.label.findMany({
    where: { name: { in: Object.values(HYGIENE_LABELS) } },
    select: { name: true, _count: { select: { people: true } } },
  });
  return Object.values(HYGIENE_LABELS).map((name) => ({ label: name, count: labels.find((l) => l.name === name)?._count.people ?? 0 }));
}
