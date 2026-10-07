import { NextRequest, NextResponse } from "next/server";
import { autoRetryCallbackUrl, verifyQstashSignature } from "@/lib/qstash";
import { runAutoRetry } from "@/lib/autoRetry";

// QStash's delayed callback for the automatic retry of a finished send —
// see lib/autoRetry.ts. Always 200 once the signature checks out: a
// non-2xx would only make QStash replay a retry that already ran.
export const maxDuration = 60;

const CHANNEL = "email" as const;

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!(await verifyQstashSignature(rawBody, req.headers.get("upstash-signature"), autoRetryCallbackUrl(CHANNEL)))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  const body = JSON.parse(rawBody || "{}");
  const broadcastId = body?.broadcastId as string | undefined;
  if (!broadcastId) return NextResponse.json({ error: "missing_broadcastId" }, { status: 400 });
  try {
    const outcome = await runAutoRetry(CHANNEL, broadcastId);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error("auto-retry failed", CHANNEL, broadcastId, err);
    return NextResponse.json({ ok: false, error: "auto_retry_failed" });
  }
}
