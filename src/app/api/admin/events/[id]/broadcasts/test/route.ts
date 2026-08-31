import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { emailProvider } from "@/lib/email";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";
import { requireUser } from "@/lib/auth/guard";

// "Send test email" — our previous ticketing platform's own field in the broadcast composer.
// A real send to real addresses the admin controls, but deliberately
// outside the real audience/consent/EmailLog machinery: this is the admin
// checking their own draft looks right, not a broadcast to a subscriber,
// so no unsubscribe link and no log row.
const bodySchema = z.object({
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  to: z.array(z.string().email()).min(1).max(10),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { subject, bodyHtml, to } = parsed.data;
  const safeHtml = sanitizeEventDescription(bodyHtml);
  const html = `<div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 0 auto; color:#1a1a1a;">
    <p style="background:#fdf1e6; color:#8a5a1f; padding:8px 12px; border-radius:6px; font-size:13px;">Este es un correo de PRUEBA — no se envió a ningún inscrito real.</p>
    ${safeHtml}
  </div>`;

  // sendTransactional, not sendMarketing — matches the real channel a
  // sent event broadcast now uses (see lib/broadcasts.ts's own comment),
  // so this preview reflects the actual From address/Configuration Set.
  const results = await Promise.allSettled(
    to.map((addr) => emailProvider.sendTransactional({ to: addr, subject: `[PRUEBA] ${subject}`, text: subject, html }))
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  return NextResponse.json({ ok: failed === 0, sent, failed });
}
