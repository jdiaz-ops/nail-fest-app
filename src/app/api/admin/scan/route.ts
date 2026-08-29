import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordScan } from "@/lib/scan";
import { requireUser } from "@/lib/auth/guard";

// Both roles: this is the endpoint the scanner PWA itself calls on every
// decode, and STAFF's whole job is scanning — see /admin/scan/page.tsx.
// scannedAt/clientScanId are only ever sent when this is being called for
// a scan that actually happened offline and is only now reaching the
// server — see lib/offlineScan.ts and /api/admin/scan/sync (the batched
// version of this same path, used to replay a whole queue at once).
const bodySchema = z.object({
  token: z.string().min(1),
  eventId: z.string().min(1),
  scannerLabel: z.string().optional(),
  scannedAt: z.string().datetime().optional(),
  clientScanId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "STAFF"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const { token, eventId, scannerLabel, scannedAt, clientScanId } = parsed.data;
  const outcome = await recordScan(token, eventId, scannerLabel, {
    scannedAt: scannedAt ? new Date(scannedAt) : undefined,
    clientScanId,
  });
  return NextResponse.json(outcome);
}
