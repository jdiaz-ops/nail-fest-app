import { z } from "zod";

// Shared zod validator for SegmentFilter (lib/segments/builder.ts) — was
// duplicated across /api/broadcasts, /api/admin/segments, and now
// /api/admin/segments/preview; one definition instead of three drifting.
export const conditionSchema = z.union([
  z.object({ field: z.literal("event"), eventSlug: z.string() }),
  z.object({ field: z.literal("attended"), eventSlug: z.string() }),
  z.object({ field: z.literal("city"), city: z.string() }),
  z.object({ field: z.literal("profession"), profession: z.string() }),
]);

export const filterSchema = z.object({
  include: z.array(conditionSchema),
  exclude: z.array(conditionSchema),
});
