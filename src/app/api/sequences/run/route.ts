import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { runSequences } from "@/lib/sequences/engine";

// «Secuencias» (2026-10-30): once a day, 9 a. m. (vercel.json; every 5 minutes until 2026-11-12 — Vercel's Hobby plan allows only daily crons), the sequences
// the team turned on — who entered their segment, who left, and each step
// that's due (lib/sequences/engine.ts). With none on, one query and done.
export const maxDuration = 60;

async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runSequences());
}

export const GET = handle;
export const POST = handle;
