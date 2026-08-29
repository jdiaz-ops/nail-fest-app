import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordScan } from "@/lib/scan";
import { requireUser } from "@/lib/auth/guard";

// Both roles: this is the endpoint the scanner PWA itself calls on every
// decode, and STAFF's whole job is scanning — see /admin/scan/page.tsx.
const bodySchema = z.object({
  token: z.string().min(1),
  eventId: z.string().min(1),
  scannerLabel: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "STAFF"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { token, eventId, scannerLabel } = parsed.data;
  const outcome = await recordScan(token, eventId, scannerLabel);
  return NextResponse.json(outcome);
}
