import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordScan } from "@/lib/scan";
import { requireUser } from "@/lib/auth/guard";

// Replays a whole batch of scans that happened while the phone was
// offline — one round trip instead of one per queued scan, since a real
// outage can queue up dozens. Each item gets recordScan()'s own
// idempotency check (clientScanId), so retrying a batch that partially
// succeeded never double-counts the ones that already landed.
//
// Every item is processed and reported individually — one bad token in a
// batch of 40 must never sink the other 39; that's exactly the kind of
// thing recordScan() already handles as a real, loggable outcome
// (INVALID_TOKEN) rather than an error.
const bodySchema = z.object({
  eventId: z.string().min(1),
  scans: z
    .array(
      z.object({
        token: z.string().min(1),
        scannerLabel: z.string().optional(),
        scannedAt: z.string().datetime(),
        clientScanId: z.string().uuid(),
      })
    )
    .min(1)
    .max(200), // one battery-length door shift's worth, generously — a real cap against an abusive/broken client
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "STAFF", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { eventId, scans } = parsed.data;

  const results: { clientScanId: string; ok: boolean; result?: string }[] = [];
  // Sequential, not Promise.all — these can include multiple scans of the
  // SAME registration (a real re-entry that happened offline), and
  // recordScan()'s "is there already a valid scan" check has to see each
  // prior one land before the next runs, or two genuinely-sequential
  // re-entries could both resolve as VALID_FIRST.
  for (const scan of scans) {
    try {
      const outcome = await recordScan(scan.token, eventId, scan.scannerLabel, {
        scannedAt: new Date(scan.scannedAt),
        clientScanId: scan.clientScanId,
      });
      results.push({ clientScanId: scan.clientScanId, ok: true, result: outcome.result });
    } catch (err) {
      // Never let one bad row abort the batch — everything else still
      // gets its own chance, and this one just stays queued for the next
      // sync attempt (the client only dequeues clientScanIds present here
      // with ok:true).
      console.error("scan sync item failed", scan.clientScanId, err);
      results.push({ clientScanId: scan.clientScanId, ok: false });
    }
  }

  return NextResponse.json({ results });
}
