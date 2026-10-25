import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { getLibrarySettings } from "@/lib/library/settings";
import { YoutubeError } from "@/lib/library/youtube";
import { runAutopilot } from "@/lib/library/youtubeAutopilot";
import { importNewUploads } from "@/lib/library/youtubeImport";

// The YouTube autopilot by itself, every ten minutes — declared in
// vercel.json's `crons`, same auth as every other cron here: the channel's
// new videos every six hours, then Claude reviews and publishes the ones
// waiting (lib/library/youtubeAutopilot.ts), three requests at the same
// time — about 24 videos a round, so the channel's first hundreds take a
// few hours when nobody keeps the tab open. Switched off in the tab, it
// does nothing.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const IMPORT_EVERY_MS = 6 * 60 * 60 * 1000;

async function handle(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getLibrarySettings();
  if (!settings.youtubeAutopilot || !settings.youtubeUploadsId || !settings.youtubeApiKey) return NextResponse.json({ ok: true, skipped: "off" });

  const started = Date.now();
  let imported: { added: number; complete: boolean } | { problem: string } | null = null;
  if (!settings.youtubeImportedAt || started - settings.youtubeImportedAt.getTime() > IMPORT_EVERY_MS) {
    try {
      // The whole channel the first time (it starts over from the newest
      // until it gets to the end once), only the newest after.
      imported = await importNewUploads(settings.youtubeImportedAt ? 45_000 : 200_000);
    } catch (error) {
      if (!(error instanceof YoutubeError)) throw error;
      imported = { problem: error.problem };
    }
  }
  // No request starts late: the round fits in the function's five minutes —
  // after a long import, Claude goes on in the next one.
  if (Date.now() - started > 60_000) return NextResponse.json({ ok: true, imported, skipped: "next" });
  return NextResponse.json({ ok: true, imported, ...(await runAutopilot({ lanes: 3, budgetMs: imported ? 10_000 : 40_000 })) });
}

export const GET = handle;
export const POST = handle;
