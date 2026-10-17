import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { undoCheckIn } from "@/lib/scan";
import { requireUser } from "@/lib/auth/guard";

const bodySchema = z.object({ token: z.string().min(1), eventId: z.string().min(1), scannerLabel: z.string().optional() });

// "Quitar el check-in" from the scanner's door list — see lib/scan.ts's
// undoCheckIn. Same roles as scanning itself: the mistake usually gets
// noticed by whoever made it, at the door.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "STAFF", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { token, eventId, scannerLabel } = parsed.data;
  const outcome = await undoCheckIn(token, eventId, scannerLabel);
  return NextResponse.json(outcome, { status: outcome.ok ? 200 : 409 });
}
