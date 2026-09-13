import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getActiveConsentEmails } from "@/lib/consent";
import { analyzeEmailQuality } from "@/lib/email/qualityCheck";

// A few hundred distinct domains × one DNS lookup each, in batches of 20
// (see qualityCheck.ts's DNS_CONCURRENCY) — comfortably fits in a minute
// for a real Nail Fest-sized list, but well past the Vercel default. An
// explicit admin-triggered action (never on page load), same posture as
// the WhatsApp webhook route's own maxDuration bump.
export const maxDuration = 60;

// Pre-flight list-hygiene check over the real MARKETING-consented pool
// (never the raw "Personas totales" — a suppressed address has nothing
// left to check) — see qualityCheck.ts's own comment for exactly what
// this catches and, just as importantly, what it can't. Defensive cap on
// the returned findings list — the honest expectation is a few hundred
// out of tens of thousands, but nothing here assumes that.
const MAX_FINDINGS_RETURNED = 5000;

export async function POST(_req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const people = await getActiveConsentEmails("MARKETING");
  const summary = await analyzeEmailQuality(people.map((p) => p.email));

  return NextResponse.json({
    ok: true,
    totalChecked: summary.totalChecked,
    totalDomains: summary.totalDomains,
    countByReason: summary.countByReason,
    findings: summary.findings.slice(0, MAX_FINDINGS_RETURNED),
    truncated: summary.findings.length > MAX_FINDINGS_RETURNED,
  });
}
