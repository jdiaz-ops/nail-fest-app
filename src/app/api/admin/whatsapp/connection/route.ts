import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { requireUser } from "@/lib/auth/guard";
import { subscribeAppToWaba } from "@/lib/whatsapp/meta";

// Same "history of rows, most recent wins" pattern as
// /api/admin/meta-connection — see lib/whatsapp/connection.ts.
const bodySchema = z.object({
  accessToken: z.string().min(20),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  displayPhoneNumber: z.string().optional(),
  webhookVerifyToken: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { accessToken, wabaId, phoneNumberId, displayPhoneNumber, webhookVerifyToken } = parsed.data;

  await db.whatsAppConnection.create({
    data: {
      wabaId,
      phoneNumberId,
      displayPhoneNumber: displayPhoneNumber || null,
      accessTokenEnc: encryptSecret(accessToken),
      webhookVerifyToken,
    },
  });

  // Best-effort — see subscribeAppToWaba's own comment ("shadow
  // delivery"). Never fails the save itself: the connection is real and
  // usable for sending either way, this only affects whether inbound
  // messages/status updates reach OUR webhook. Surfaced to the UI so a
  // failure here isn't silent — a retry button covers it.
  let subscribed = false;
  let subscribeError: string | null = null;
  try {
    await subscribeAppToWaba(wabaId, accessToken);
    subscribed = true;
  } catch (err) {
    subscribeError = err instanceof Error ? err.message : String(err);
    console.error("whatsapp connection: failed to subscribe app to WABA", err);
  }

  return NextResponse.json({ ok: true, subscribed, subscribeError });
}
