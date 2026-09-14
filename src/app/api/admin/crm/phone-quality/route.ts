import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getActiveConsentPhones } from "@/lib/consent";
import { analyzePhoneQuality } from "@/lib/phone/phoneQuality";

// Pre-flight list hygiene for WhatsApp — over the real WHATSAPP-
// consented pool, same reasoning as email-quality: no point checking a
// phone nobody has consent to be messaged on. Pure in-memory checks (see
// phoneQuality.ts), so no maxDuration bump needed like the DNS-heavy
// email-quality route.
const MAX_FINDINGS_RETURNED = 5000;

export async function POST(_req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const people = await getActiveConsentPhones("WHATSAPP");
  const summary = analyzePhoneQuality(people);

  return NextResponse.json({
    ok: true,
    totalChecked: summary.totalChecked,
    countByReason: summary.countByReason,
    findings: summary.findings.slice(0, MAX_FINDINGS_RETURNED),
    truncated: summary.findings.length > MAX_FINDINGS_RETURNED,
  });
}
