import { z } from "zod";

// Shared zod validator for SegmentFilter (lib/segments/builder.ts) — was
// duplicated across /api/broadcasts, /api/admin/segments, and now
// /api/admin/segments/preview; one definition instead of three drifting.
// Only validates what a CLIENT submits going forward — segments already
// saved with the old single-value shape are read straight from the DB
// (never through this schema) and normalized by builder.ts's own
// normalizeFilter, so this only ever needs to know the current shape.
export const conditionSchema = z.union([
  z.object({ field: z.literal("event"), eventSlugs: z.array(z.string()).min(1) }),
  z.object({ field: z.literal("attended"), eventSlugs: z.array(z.string()).min(1) }),
  z.object({ field: z.literal("city"), cities: z.array(z.string()).min(1) }),
  z.object({ field: z.literal("profession"), professions: z.array(z.string()).min(1) }),
  z.object({ field: z.literal("label"), labels: z.array(z.string()).min(1) }),
  z.object({ field: z.literal("phoneCountry"), codes: z.array(z.string()).min(1) }),
]);

export const filterSchema = z.object({
  include: z.array(conditionSchema),
  exclude: z.array(conditionSchema),
});
