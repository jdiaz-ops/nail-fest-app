import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";

// "" (or omitted) clears the per-event override — "Global confirmation
// (Applies to all events)" in the editor's own radio choice — falling
// back to whatever the account-wide template resolves to. See
// Event.confirmationEmailHtml's own schema comment for the full chain.
// confirmationEmailSubject follows the exact same "" = clear convention.
// confirmationEmailDesign: "IMPARABLES" picks Manicuristas Imparables' own
// designed email (2026-10-29), null goes back to the body above; omitted,
// it stays as it is. shareText is that email's «Compartir por WhatsApp»
// message (2026-10-30), "" back to the default; omitted, as it is.
// "NAIL_FEST" is Nail Fest's own for an event at a place (2026-10-30), with
// its «Antes de ir» (confirmationTips: [] back to the default ones).
const bodySchema = z.object({
  confirmationEmailHtml: z.string(),
  confirmationEmailSubject: z.string().optional(),
  confirmationEmailDesign: z.enum(["IMPARABLES", "NAIL_FEST"]).nullable().optional(),
  shareText: z.string().max(500).optional(),
  confirmationTips: z.array(z.string().max(200)).max(5).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const html = parsed.data.confirmationEmailHtml;
  const subject = parsed.data.confirmationEmailSubject;
  const design = parsed.data.confirmationEmailDesign;
  const shareText = parsed.data.shareText;
  const tips = parsed.data.confirmationTips?.map((t) => t.trim()).filter(Boolean);
  try {
    await db.event.update({
      where: { id: params.id },
      data: {
        confirmationEmailHtml: html ? sanitizeEventDescription(html) : null,
        ...(subject !== undefined ? { confirmationEmailSubject: subject || null } : {}),
        ...(design !== undefined ? { confirmationEmailDesign: design } : {}),
        ...(shareText !== undefined ? { shareText: shareText.trim() || null } : {}),
        ...(tips !== undefined ? { confirmationTips: tips } : {}),
      },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
