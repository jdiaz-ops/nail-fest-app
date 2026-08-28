import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

// Protected by middleware (same Basic Auth as the rest of /admin). No
// separate secret needed here — unlike /api/admin/seed, this isn't meant
// to be triggered by pasting a URL (the token is too sensitive to sit in a
// URL/browser history), so it's a real form POST instead.

const bodySchema = z.object({
  systemUserToken: z.string().min(20),
  adAccountId: z.string().min(1),
  pixelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { systemUserToken, adAccountId, pixelId } = parsed.data;

  await db.metaConnection.create({
    data: {
      adAccountId: adAccountId.replace(/^act_/, ""),
      pixelId,
      systemUserTokenEnc: encryptSecret(systemUserToken),
    },
  });

  return NextResponse.json({ ok: true });
}
