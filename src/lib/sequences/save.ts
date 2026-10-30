import { z } from "zod";
import { db } from "@/lib/db";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { MAX_DELAY_MINUTES } from "./shared";

// What the sequence editor (components/SequenceEditor.tsx) saves: its name,
// segment and event, and its steps — validated here, sorted by when they go
// out. Steps keep their id across saves, so what each one sent stays with it.

export const stepSchema = z.object({
  id: z.string().optional(),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  delayMinutes: z.number().int().min(0).max(MAX_DELAY_MINUTES),
  subject: z.string().max(200).nullish(),
  bodyHtml: z.string().max(100_000).nullish(),
  buttonText: z.string().max(80).nullish(),
  buttonTarget: z.enum(["checkout", "event"]).nullish(),
  templateId: z.string().nullish(),
  variableMapping: z.record(z.string()).nullish(),
});

export const sequenceSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre.").max(120),
  segmentId: z.string().min(1, "Elige el segmento."),
  eventId: z.string().min(1).nullish(),
  steps: z.array(stepSchema).min(1, "Agrega al menos un paso.").max(10, "Hasta 10 pasos."),
});

export type SequenceInput = z.infer<typeof sequenceSchema>;

/** What's wrong with it, in words for the team; null when it can be saved. */
export async function sequenceProblem(input: SequenceInput): Promise<string | null> {
  if (!(await db.segmentDefinition.findUnique({ where: { id: input.segmentId }, select: { id: true } }))) return "Ese segmento ya no existe.";
  if (input.eventId && !(await db.event.findUnique({ where: { id: input.eventId }, select: { id: true } }))) return "Ese evento ya no existe.";
  const templateIds = input.steps.flatMap((s) => (s.channel === "WHATSAPP" && s.templateId ? [s.templateId] : []));
  const approved = new Set(
    (await db.whatsAppTemplate.findMany({ where: { id: { in: templateIds }, status: "APPROVED" }, select: { id: true } })).map((t) => t.id)
  );
  for (const [i, s] of input.steps.entries()) {
    const n = i + 1;
    if (s.channel === "EMAIL") {
      if (!s.subject?.trim()) return `Al correo del paso ${n} le falta el asunto.`;
      if (!s.bodyHtml?.replace(/<[^>]+>/g, "").trim()) return `Al correo del paso ${n} le falta el texto.`;
      if (s.buttonText?.trim() && !s.buttonTarget) return `Elige a dónde lleva el botón del paso ${n}.`;
    } else {
      if (!s.templateId) return `Elige la plantilla de WhatsApp del paso ${n}.`;
      if (!approved.has(s.templateId)) return `La plantilla del paso ${n} no está aprobada por Meta.`;
    }
  }
  return null;
}

/** Creates it (no id) or updates it; returns its id. Saved off for a new one — turning it on is its own step. */
export async function saveSequence(id: string | null, input: SequenceInput): Promise<string> {
  const steps = input.steps
    .map((s, i) => ({ s, i }))
    .sort((a, b) => a.s.delayMinutes - b.s.delayMinutes || a.i - b.i)
    .map(({ s }, position) => ({
      id: s.id,
      position,
      delayMinutes: s.delayMinutes,
      channel: s.channel,
      subject: s.channel === "EMAIL" ? s.subject?.trim() ?? null : null,
      bodyHtml: s.channel === "EMAIL" && s.bodyHtml ? sanitizeEventDescription(s.bodyHtml) : null,
      buttonText: s.channel === "EMAIL" ? s.buttonText?.trim() || null : null,
      buttonTarget: s.buttonTarget ?? null,
      templateId: s.channel === "WHATSAPP" ? s.templateId ?? null : null,
      variableMapping: s.channel === "WHATSAPP" ? s.variableMapping ?? {} : undefined,
    }));
  const fields = { name: input.name.trim(), segmentId: input.segmentId, eventId: input.eventId ?? null };

  return db.$transaction(async (tx) => {
    if (!id) {
      const created = await tx.sequence.create({
        data: { ...fields, steps: { create: steps.map(({ id: _id, ...step }) => step) } },
        select: { id: true },
      });
      return created.id;
    }
    await tx.sequence.update({ where: { id }, data: fields });
    const existing = new Set((await tx.sequenceStep.findMany({ where: { sequenceId: id }, select: { id: true } })).map((s) => s.id));
    const kept = new Set(steps.flatMap((s) => (s.id && existing.has(s.id) ? [s.id] : [])));
    // A step taken out goes with what it sent.
    await tx.sequenceStep.deleteMany({ where: { sequenceId: id, id: { notIn: [...kept] } } });
    for (const { id: stepId, ...step } of steps) {
      if (stepId && kept.has(stepId)) await tx.sequenceStep.update({ where: { id: stepId }, data: step });
      else await tx.sequenceStep.create({ data: { ...step, sequenceId: id } });
    }
    return id;
  });
}
