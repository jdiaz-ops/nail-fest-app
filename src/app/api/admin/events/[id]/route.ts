import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { updateEvent, setEventStatus } from "@/lib/events";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  venueName: z.string().optional(),
  venueAddress: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  registerButtonLabel: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  slug: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const data = parsed.data;

  // The status-only toggle (the Published/Draft dropdown in the events
  // list) doesn't carry the rest of the fields — handle it on its own so
  // it never has to re-send name/city/dates just to flip a status.
  const onlyStatus = data.status && Object.keys(data).length === 1;
  try {
    if (onlyStatus) {
      const event = await setEventStatus(params.id, data.status!);
      return NextResponse.json({ ok: true, event });
    }

    const existing = await db.event.findUniqueOrThrow({ where: { id: params.id } });
    const startsAt = data.startsAt ? new Date(data.startsAt) : existing.startsAt;
    if (Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: "invalid_body", issues: [{ path: ["startsAt"], message: "invalid date" }] }, { status: 400 });
    }
    const endsAt = data.endsAt === undefined ? existing.endsAt : data.endsAt ? new Date(data.endsAt) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: "invalid_body", issues: [{ path: ["endsAt"], message: "invalid date" }] }, { status: 400 });
    }

    const event = await updateEvent(params.id, {
      name: data.name ?? existing.name,
      city: data.city ?? existing.city,
      venueName: data.venueName ?? existing.venueName ?? "",
      venueAddress: data.venueAddress ?? existing.venueAddress ?? "",
      description: data.description ?? existing.description ?? "",
      imageUrl: data.imageUrl === undefined ? existing.imageUrl : data.imageUrl,
      registerButtonLabel: data.registerButtonLabel ?? existing.registerButtonLabel ?? "",
      startsAt,
      endsAt,
      capacity: data.capacity === undefined ? existing.capacity : data.capacity,
      status: data.status ?? existing.status,
      slug: data.slug,
    });
    return NextResponse.json({ ok: true, event });
  } catch (err) {
    console.error("update event failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
