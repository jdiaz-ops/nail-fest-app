import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createEvent, DEFAULT_REGISTER_BUTTON_LABEL } from "@/lib/events";

// Protected by middleware (same Basic Auth as the rest of /admin).
const bodySchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  venueName: z.string().default(""),
  venueAddress: z.string().default(""),
  description: z.string().default(""),
  imageUrl: z.string().nullable().optional(),
  registerButtonLabel: z.string().optional(),
  startsAt: z.string().datetime().or(z.string().min(1)),
  endsAt: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  slug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;
  const startsAt = new Date(data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "invalid_body", issues: [{ path: ["startsAt"], message: "invalid date" }] }, { status: 400 });
  }
  const endsAt = data.endsAt ? new Date(data.endsAt) : null;
  if (endsAt && Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "invalid_body", issues: [{ path: ["endsAt"], message: "invalid date" }] }, { status: 400 });
  }

  const event = await createEvent({
    name: data.name,
    city: data.city,
    venueName: data.venueName,
    venueAddress: data.venueAddress,
    description: data.description,
    imageUrl: data.imageUrl ?? null,
    registerButtonLabel: data.registerButtonLabel?.trim() || DEFAULT_REGISTER_BUTTON_LABEL,
    startsAt,
    endsAt,
    capacity: data.capacity ?? null,
    status: data.status,
    slug: data.slug,
  });
  return NextResponse.json({ ok: true, event });
}
