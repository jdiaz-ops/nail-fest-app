import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bulkActiveConsent } from "@/lib/consent";
import { getOrgSettings } from "@/lib/settings";
import { segmentPersonIds, type SegmentFilter } from "@/lib/segments/builder";
import { sendStep, type StepOutcome } from "./send";
import { SENDING_HOURS } from "./shared";

// «Secuencias» (2026-10-30): automatic follow-ups for the people of a saved
// segment — the abandoned carts first — run every 5 minutes by
// /api/sequences/run, only for the sequences the team turned on:
//   1. whoever is in the segment and never was in this sequence enters it
//      now — once: after that, never again;
//   2. out of the segment, nothing goes out to her; a day out and it's over
//      (for an abandoned cart, she bought); back in before that, it goes on
//      (she was trying to pay again, and didn't);
//   3. each step goes out once its time since she entered has come: the
//      first one not yet behind her and not earlier than the last she got
//      (a step added later for an earlier moment isn't sent late). By email
//      only with her marketing permission and an email the account didn't
//      block; by WhatsApp only with her WhatsApp permission and a number.
//      Never twice — its send is claimed before it goes out — only from
//      8 a. m. to 9 p. m. where the account is, and at most
//      MAX_SENDS_PER_RUN a run: the rest go in the next ones.

const OUT_FOR_GOOD_MS = 24 * 60 * 60_000;
const MAX_SENDS_PER_RUN = 120;
const CONCURRENCY = 5;
// Rows per insert: well under Postgres' 32,767 bind variables, for a segment of tens of thousands.
const INSERT_BATCH = 5000;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The same change to many enrollments, in batches. */
async function updateEnrollments(ids: string[], data: Prisma.SequenceEnrollmentUpdateManyMutationInput): Promise<void> {
  for (const batch of chunk(ids, INSERT_BATCH)) await db.sequenceEnrollment.updateMany({ where: { id: { in: batch }, endedAt: null }, data });
}

async function enroll(sequenceId: string, personIds: string[], data: { enteredAt: Date; endedAt?: Date; endedReason?: string }): Promise<number> {
  let count = 0;
  for (const ids of chunk(personIds, INSERT_BATCH)) {
    const r = await db.sequenceEnrollment.createMany({ data: ids.map((personId) => ({ sequenceId, personId, ...data })), skipDuplicates: true });
    count += r.count;
  }
  return count;
}

/** Whether a message can go out now: from 8 a. m. to 9 p. m. in the account's time zone. */
export function withinSendingHours(now: Date, timezone: string): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
  return hour >= SENDING_HOURS.from && hour < SENDING_HOURS.to;
}

/** Her next step, given the steps in order (delay, then position) and those already behind her: due now, not yet
 * (null), or none left (finished). */
export function nextStep<T extends { id: string; delayMinutes: number }>(
  steps: T[],
  done: Set<string>,
  enteredAt: Date,
  now: Date
): { step: T | null; finished: boolean } {
  const reached = Math.max(-1, ...steps.filter((s) => done.has(s.id)).map((s) => s.delayMinutes));
  const step = steps.find((s) => !done.has(s.id) && s.delayMinutes >= reached);
  if (!step) return { step: null, finished: true };
  return { step: enteredAt.getTime() + step.delayMinutes * 60_000 <= now.getTime() ? step : null, finished: false };
}

/** For whoever was already in the segment when it's turned on, unless the team chose to include them: set aside, never sent anything. */
export async function setAsideCurrentMembers(sequenceId: string, filter: SegmentFilter, now = new Date()): Promise<number> {
  const members = await segmentPersonIds(filter);
  const known = new Set((await db.sequenceEnrollment.findMany({ where: { sequenceId }, select: { personId: true } })).map((e) => e.personId));
  return enroll(
    sequenceId,
    members.filter((id) => !known.has(id)),
    { enteredAt: now, endedAt: now, endedReason: "skipped" }
  );
}

export interface RunTotals {
  sequences: number;
  entered: number;
  left: number;
  sent: number;
  skipped: number;
  failed: number;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

export async function runSequences(now = new Date()): Promise<RunTotals> {
  const totals: RunTotals = { sequences: 0, entered: 0, left: 0, sent: 0, skipped: 0, failed: 0 };
  const sequences = await db.sequence.findMany({
    where: { enabled: true },
    include: { segment: true, event: true, steps: { include: { template: true }, orderBy: [{ delayMinutes: "asc" }, { position: "asc" }] } },
  });
  if (!sequences.length) return totals;

  const orgSettings = await getOrgSettings();
  const sendingHours = withinSendingHours(now, orgSettings.timezone);
  const blocked = new Set(orgSettings.bannedEmails.map((e) => e.trim().toLowerCase()));
  let budget = MAX_SENDS_PER_RUN;

  for (const sequence of sequences) {
    totals.sequences++;
    const members = new Set(await segmentPersonIds(sequence.segment.filter as unknown as SegmentFilter));
    const all = await db.sequenceEnrollment.findMany({
      where: { sequenceId: sequence.id },
      select: { id: true, personId: true, outSince: true, endedAt: true },
    });
    const enrollments = all.filter((e) => !e.endedAt);

    // 1. In.
    const known = new Set(all.map((e) => e.personId));
    const newcomers = [...members].filter((id) => !known.has(id));
    if (newcomers.length) totals.entered += await enroll(sequence.id, newcomers, { enteredAt: now });

    // 2. Out, back, out for good.
    const wentOut = enrollments.filter((e) => !members.has(e.personId) && !e.outSince).map((e) => e.id);
    const cameBack = enrollments.filter((e) => members.has(e.personId) && e.outSince).map((e) => e.id);
    const gone = enrollments.filter((e) => !members.has(e.personId) && e.outSince && now.getTime() - e.outSince.getTime() >= OUT_FOR_GOOD_MS).map((e) => e.id);
    await updateEnrollments(wentOut, { outSince: now });
    await updateEnrollments(cameBack, { outSince: null });
    await updateEnrollments(gone, { endedAt: now, endedReason: "left" });
    totals.left += gone.length;

    // 3. What's due, for those in the segment now.
    if (!sequence.steps.length) continue;
    const [current, sends] = await Promise.all([
      db.sequenceEnrollment.findMany({ where: { sequenceId: sequence.id, endedAt: null, outSince: null }, select: { id: true, personId: true, enteredAt: true } }),
      db.sequenceSend.findMany({ where: { enrollment: { sequenceId: sequence.id, endedAt: null } }, select: { enrollmentId: true, stepId: true } }),
    ]);
    const doneBy = new Map<string, Set<string>>();
    for (const s of sends) doneBy.set(s.enrollmentId, (doneBy.get(s.enrollmentId) ?? new Set()).add(s.stepId));
    const finished: string[] = [];
    const due: { enrollmentId: string; personId: string; step: (typeof sequence.steps)[number] }[] = [];
    for (const e of current) {
      if (!members.has(e.personId)) continue;
      const { step, finished: over } = nextStep(sequence.steps, doneBy.get(e.id) ?? new Set(), e.enteredAt, now);
      if (over) finished.push(e.id);
      else if (step) due.push({ enrollmentId: e.id, personId: e.personId, step });
    }
    await updateEnrollments(finished, { endedAt: now, endedReason: "done" });
    if (!sendingHours || budget <= 0 || !due.length) continue;

    const batch = due.slice(0, budget);
    budget -= batch.length;
    const people = await db.person.findMany({
      where: { id: { in: batch.map((d) => d.personId) } },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, city: true },
    });
    const byId = new Map(people.map((p) => [p.id, p]));
    const ids = people.map((p) => p.id);
    const [marketing, whatsapp] = await Promise.all([bulkActiveConsent(ids, "MARKETING"), bulkActiveConsent(ids, "WHATSAPP")]);

    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      const results = await Promise.allSettled(
        batch.slice(i, i + CONCURRENCY).map(async (d) => {
          const person = byId.get(d.personId);
          if (!person) return;
          // Claimed before it goes out: never twice, even with two runs at once.
          let claim: { id: string };
          try {
            claim = await db.sequenceSend.create({ data: { enrollmentId: d.enrollmentId, stepId: d.step.id, status: "SENDING" }, select: { id: true } });
          } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
            throw err;
          }
          const refused =
            d.step.channel === "EMAIL"
              ? blocked.has(person.email.trim().toLowerCase())
                ? "Su correo está bloqueado en la cuenta."
                : !marketing.has(person.id)
                ? "No ha dado permiso para correos de mercadeo."
                : null
              : !whatsapp.has(person.id)
              ? "No ha dado permiso para WhatsApp."
              : null;
          const outcome: StepOutcome = refused
            ? { status: "SKIPPED", detail: refused }
            : await sendStep(d.step, person, {
                person,
                event: sequence.event,
                sequenceName: sequence.name,
                timezone: orgSettings.timezone,
                language: orgSettings.language,
              }).catch((err): StepOutcome => ({ status: "FAILED", detail: errorText(err).slice(0, 300) }));
          await db.sequenceSend.update({ where: { id: claim.id }, data: { status: outcome.status, detail: outcome.detail } });
          if (outcome.status === "SENT") totals.sent++;
          else if (outcome.status === "SKIPPED") totals.skipped++;
          else totals.failed++;
        })
      );
      for (const r of results) if (r.status === "rejected") console.error("sequences: a step failed to run", sequence.id, r.reason);
    }
  }
  return totals;
}
