import { z } from "zod";

// Shared by both /api/admin/events/[id]/broadcasts (POST — create) and
// its sibling [broadcastId]/route.ts (PATCH — "Editar" on a still-QUEUED
// broadcast), so the two validate against the exact same shape instead
// of a copy that could drift. Lives here rather than being exported
// from the POST route.ts itself — a route.ts file may only export HTTP
// method handlers plus Next's own small allowlist (runtime, dynamic,
// etc.); anything else fails the framework's own route typecheck.
export const eventBroadcastBodySchema = z
  .object({
    ticketTypeId: z.string().nullable().optional(),
    subject: z.string().min(1),
    bodyHtml: z.string().min(1),
    attachTicketPdf: z.boolean().optional().default(false),
    scheduleKind: z.enum(["IMMEDIATE", "AT_DATETIME", "BEFORE_EVENT_START", "AFTER_EVENT_END"]),
    scheduledAt: z.string().datetime().optional(),
    scheduleOffsetMinutes: z.number().int().min(0).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleKind === "AT_DATETIME" && !data.scheduledAt) {
      ctx.addIssue({ code: "custom", message: "scheduledAt required for AT_DATETIME", path: ["scheduledAt"] });
    }
    if ((data.scheduleKind === "BEFORE_EVENT_START" || data.scheduleKind === "AFTER_EVENT_END") && data.scheduleOffsetMinutes == null) {
      ctx.addIssue({ code: "custom", message: "scheduleOffsetMinutes required", path: ["scheduleOffsetMinutes"] });
    }
  });
