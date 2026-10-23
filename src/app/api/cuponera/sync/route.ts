import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { syncCuponera } from "@/lib/cuponera/sync";

// The cuponera's catalog from Marcolini, every hour — declared in
// vercel.json's `crons`, same auth as every other cron here — so a change
// in Marcolini shows within the hour; only what changed gets written
// (lib/cuponera/sync.ts). Not more often: every sync costs Marcolini's
// database about ten queries, and syncing every minute used up its Prisma
// Postgres plan (2026-10-22). The admin's "Sincronizar ahora" button uses
// /api/admin/cuponera/sync instead.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await syncCuponera());
}

export const GET = handle;
export const POST = handle;
