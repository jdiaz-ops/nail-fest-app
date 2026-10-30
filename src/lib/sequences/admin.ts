import { db } from "@/lib/db";
import { normalizeFilter, type SegmentFilter } from "@/lib/segments/builder";
import { dynamicUrlButtonIndex } from "@/lib/whatsapp/automations";
import { WHATSAPP_MERGE_TAGS } from "@/lib/whatsapp/mergeTags";
import { SEQUENCE_LINK_TAGS } from "./shared";

// What CRM → Secuencias shows (2026-10-30): the editor's choices, and how
// each sequence is doing.

export interface EditorOptions {
  segments: { id: string; name: string; cartEventId: string | null }[];
  events: { id: string; name: string }[];
  templates: { id: string; name: string; language: string; bodyText: string; variableCount: number; hasLinkButton: boolean }[];
  whatsappTags: { key: string; label: string }[];
}

export async function sequenceEditorOptions(): Promise<EditorOptions> {
  const [segments, events, templates] = await Promise.all([
    db.segmentDefinition.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, filter: true } }),
    db.event.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true, slug: true } }),
    db.whatsAppTemplate.findMany({ where: { status: "APPROVED" }, orderBy: { name: "asc" } }),
  ]);
  const eventIdBySlug = new Map(events.map((e) => [e.slug, e.id]));
  return {
    // A segment of one event's abandoned carts brings that event along.
    segments: segments.map((s) => {
      let cartEventId: string | null = null;
      try {
        const cart = normalizeFilter(s.filter as unknown as SegmentFilter).include.find((c) => c.field === "abandonedCart");
        if (cart?.field === "abandonedCart" && cart.eventSlugs.length === 1) cartEventId = eventIdBySlug.get(cart.eventSlugs[0]!) ?? null;
      } catch {
        // An old filter this code doesn't read: no event to bring.
      }
      return { id: s.id, name: s.name, cartEventId };
    }),
    events: events.map((e) => ({ id: e.id, name: e.name })),
    templates: templates.map((t) => ({
      id: t.id,
      name: t.name,
      language: t.language,
      bodyText: t.bodyText ?? "",
      variableCount: t.variableCount,
      hasLinkButton: dynamicUrlButtonIndex(t.buttons) >= 0,
    })),
    whatsappTags: [...WHATSAPP_MERGE_TAGS.filter((t) => t.key !== "ZOOM_LINK"), ...SEQUENCE_LINK_TAGS],
  };
}

export interface SequenceCounts {
  /** On her way through it, in the segment now. */
  inProgress: number;
  /** On her way, but out of the segment for now (a day out and she leaves). */
  out: number;
  done: number;
  left: number;
  setAside: number;
  sent: number;
  skipped: number;
  failed: number;
}

const empty = (): SequenceCounts => ({ inProgress: 0, out: 0, done: 0, left: 0, setAside: 0, sent: 0, skipped: 0, failed: 0 });

export async function sequenceCounts(sequenceIds: string[]): Promise<Map<string, SequenceCounts>> {
  const counts = new Map(sequenceIds.map((id) => [id, empty()]));
  if (!sequenceIds.length) return counts;
  const [byReason, outNow, steps] = await Promise.all([
    db.sequenceEnrollment.groupBy({ by: ["sequenceId", "endedReason"], where: { sequenceId: { in: sequenceIds } }, _count: { _all: true } }),
    db.sequenceEnrollment.groupBy({ by: ["sequenceId"], where: { sequenceId: { in: sequenceIds }, endedAt: null, outSince: { not: null } }, _count: { _all: true } }),
    db.sequenceStep.findMany({ where: { sequenceId: { in: sequenceIds } }, select: { id: true, sequenceId: true } }),
  ]);
  for (const r of byReason) {
    const c = counts.get(r.sequenceId)!;
    const n = r._count._all;
    if (r.endedReason === "done") c.done += n;
    else if (r.endedReason === "left") c.left += n;
    else if (r.endedReason === "skipped") c.setAside += n;
    else c.inProgress += n;
  }
  for (const r of outNow) {
    const c = counts.get(r.sequenceId)!;
    c.out += r._count._all;
    c.inProgress -= r._count._all;
  }
  const sequenceOfStep = new Map(steps.map((s) => [s.id, s.sequenceId]));
  if (steps.length) {
    const sends = await db.sequenceSend.groupBy({ by: ["stepId", "status"], where: { stepId: { in: steps.map((s) => s.id) } }, _count: { _all: true } });
    for (const s of sends) {
      const c = counts.get(sequenceOfStep.get(s.stepId)!)!;
      if (s.status === "SENT") c.sent += s._count._all;
      else if (s.status === "SKIPPED") c.skipped += s._count._all;
      else if (s.status === "FAILED") c.failed += s._count._all;
    }
  }
  return counts;
}
