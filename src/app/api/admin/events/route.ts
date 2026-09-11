import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createEvent, DEFAULT_REGISTER_BUTTON_LABEL } from "@/lib/events";
import { requireUser } from "@/lib/auth/guard";

const scheduleDaySchema = z.object({
  opensAt: z.string().min(1),
  closesAt: z.string().min(1),
});

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
  // Real per-day open/close times — see EventForm.tsx's own "Horario
  // real" section and lib/eventSchedule.ts. Optional, defaults to none
  // (the old single startsAt–endsAt range display).
  scheduleDays: z.array(scheduleDaySchema).default([]),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  slug: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

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
  for (const day of data.scheduleDays) {
    if (Number.isNaN(new Date(day.opensAt).getTime()) || Number.isNaN(new Date(day.closesAt).getTime())) {
      return NextResponse.json({ error: "invalid_body", issues: [{ path: ["scheduleDays"], message: "invalid date" }] }, { status: 400 });
    }
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
    scheduleDays: data.scheduleDays,
    status: data.status,
    slug: data.slug,
  });
  return NextResponse.json({ ok: true, event });
}
