import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { requireUser } from "@/lib/auth/guard";

const bodySchema = z.object({
  systemUserToken: z.string().min(20),
  adAccountId: z.string().min(1),
  pixelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

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
