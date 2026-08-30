import type { ConsentPurpose } from "@prisma/client";
import { db } from "@/lib/db";

// Ley 1581 (Colombia): consent is per-purpose and revocable, never one
// blanket checkbox. LOGISTICS is required to register at all (it's what
// lets us email the ticket); MARKETING and ADVERTISING are optional and
// gate the broadcast composer / Meta audience sync respectively.

export const REQUIRED_CONSENTS: ConsentPurpose[] = ["LOGISTICS"];
export const OPTIONAL_CONSENTS: ConsentPurpose[] = ["MARKETING", "ADVERTISING", "WHATSAPP"];

export async function recordConsents(params: {
  personId: string;
  registrationId: string;
  granted: Partial<Record<ConsentPurpose, boolean>>;
}) {
  const purposes = Object.keys(params.granted) as ConsentPurpose[];
  await db.$transaction(
    purposes.map((purpose) =>
      db.consent.create({
        data: {
          personId: params.personId,
          registrationId: params.registrationId,
          purpose,
          granted: Boolean(params.granted[purpose]),
        },
      })
    )
  );
}

export async function hasActiveConsent(personId: string, purpose: ConsentPurpose): Promise<boolean> {
  const latest = await db.consent.findFirst({
    where: { personId, purpose },
    orderBy: { grantedAt: "desc" },
  });
  return Boolean(latest?.granted && !latest.revokedAt);
}
