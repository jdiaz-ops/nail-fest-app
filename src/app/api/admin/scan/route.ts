import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordScan } from "@/lib/scan";

// Under /api/admin/:path* — same Basic Auth gate as the rest of /admin (see
// middleware.ts). No separate device auth for the MVP: whoever is holding a
// phone logged into /admin can scan, same trust level as everything else there.

const bodySchema = z.object({
  token: z.string().min(1),
  eventId: z.string().min(1),
  scannerLabel: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { token, eventId, scannerLabel } = parsed.data;
  const outcome = await recordScan(token, eventId, scannerLabel);
  return NextResponse.json(outcome);
}
