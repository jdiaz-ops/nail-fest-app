import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";

// "" (or omitted) clears the per-event override — "Global confirmation
// (Applies to all events)" in the editor's own radio choice — falling
// back to whatever the account-wide template resolves to. See
// Event.confirmationEmailHtml's own schema comment for the full chain.
const bodySchema = z.object({ confirmationEmailHtml: z.string() });

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const html = parsed.data.confirmationEmailHtml;
  try {
    await db.event.update({
      where: { id: params.id },
      data: { confirmationEmailHtml: html ? sanitizeEventDescription(html) : null },
    });
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
