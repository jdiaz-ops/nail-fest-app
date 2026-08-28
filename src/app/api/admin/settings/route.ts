import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrgSettings, updateOrgSettings } from "@/lib/settings";

// Shared by all six /admin/settings/* forms — each one POSTs only the
// field(s) it owns, so this stays a partial update, never a full replace.
const patchSchema = z
  .object({
    name: z.string().min(1),
    timezone: z.string().min(1),
    language: z.enum(["es", "en"]),
    replyToEmail: z.string().email().or(z.literal("")),
    privacyPolicyText: z.string(),
    bannedEmails: z.array(z.string().email()),
    cookieConsentEnabled: z.boolean(),
    selfServeResendEnabled: z.boolean(),
  })
  .partial();

export async function GET() {
  return NextResponse.json(await getOrgSettings());
}

export async function POST(req: NextRequest) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  // "" from an empty optional email input means "clear it", not "set it to
  // an empty string that fails email validation on the next read".
  const { replyToEmail, ...rest } = parsed.data;
  const updated = await updateOrgSettings({
    ...rest,
    ...(replyToEmail !== undefined ? { replyToEmail: replyToEmail || null } : {}),
  });
  return NextResponse.json({ ok: true, settings: updated });
}
