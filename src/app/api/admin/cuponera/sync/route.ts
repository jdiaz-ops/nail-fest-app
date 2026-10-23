import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { syncCuponera } from "@/lib/cuponera/sync";

// "Sincronizar ahora" in /admin/cuponera — the same sync the hourly
// cron runs (409 while that one is running).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const result = await syncCuponera();
  return NextResponse.json(result, { status: result.ok ? 200 : result.busy ? 409 : 502 });
}
