import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { syncCuponera } from "@/lib/cuponera/sync";

// Daily refresh of the cuponera's catalog from Marcolini — declared in
// vercel.json's `crons`, same auth as every other cron here. The admin's
// "Sincronizar ahora" button uses /api/admin/cuponera/sync instead.
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
