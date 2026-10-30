import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { hasNailFestAsistire } from "@/lib/nailfest/asistire";
import { nailFestEventEmailSample } from "@/lib/nailfest/eventEmailFrame";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  subject: z.string().max(300),
  bodyHtml: z.string().max(200_000),
  band: z.string().max(60).nullable().optional(),
  asistire: z.boolean().optional(),
  colega: z.boolean().optional(),
});

// The composer's «Así se ve» (2026-10-30): what it has right now, saved or
// not, in the event's design (Event.broadcastDesign) — sample data, nothing
// sent. Its HTML, for the preview's frame.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event || !hasNailFestAsistire(event)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { subject, bodyHtml, band, asistire, colega } = parsed.data;
  const email = await nailFestEventEmailSample(event, { subject, bodyHtml, band: band ?? null, asistire, colega });
  return NextResponse.json({ html: email.html });
}
