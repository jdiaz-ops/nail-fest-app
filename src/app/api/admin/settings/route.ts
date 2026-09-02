import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOrgSettings, updateOrgSettings } from "@/lib/settings";
import { requireUser } from "@/lib/auth/guard";
import { sanitizeEventDescription } from "@/lib/sanitizeHtml";

// Shared by all seven /admin/settings/* forms — each one POSTs only the
// field(s) it owns, so this stays a partial update, never a full replace.
const patchSchema = z
  .object({
    name: z.string().min(1),
    timezone: z.string().min(1),
    language: z.enum(["es", "en"]),
    replyToEmail: z.string().email().or(z.literal("")),
    privacyPolicyText: z.string(),
    termsAndConditionsText: z.string(),
    bannedEmails: z.array(z.string().email()),
    cookieConsentEnabled: z.boolean(),
    selfServeResendEnabled: z.boolean(),
    // "" means "clear it, revert to the original hand-built design" — see
    // lib/confirmationTemplate.ts's fallback chain.
    confirmationEmailHtml: z.string(),
    // Matches our previous ticketing platform's "Attach ticket vouchers as
    // a PDF" checkbox — see OrgSettings.attachTicketPdf's own schema comment.
    attachTicketPdf: z.boolean(),
    // nailfest.co homepage (/admin/homepage) — see OrgSettings.
    // homepageImageUrl's own schema comment. "" on the image/video/
    // tagline means "clear it", same reasoning as confirmationEmailHtml
    // above; the CTA label can't be saved blank, it's always shown as a
    // real button. Keeping the two background fields mutually exclusive
    // is the editor form's job (it clears the one it isn't using before
    // POSTing) — this route just stores whatever it's sent.
    homepageImageUrl: z.string(),
    homepageVideoUrl: z.string(),
    homepageTagline: z.string(),
    homepageCtaLabel: z.string().min(1),
    // nailfest.co/links (/admin/links) — see OrgSettings.linksPageImageUrl's
    // own schema comment. Same "" = clear, mutually-exclusive-by-form
    // reasoning as the homepage fields above.
    linksPageImageUrl: z.string(),
    linksPageVideoUrl: z.string(),
  })
  .partial();

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  return NextResponse.json(await getOrgSettings());
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  // "" from an empty optional email input means "clear it", not "set it to
  // an empty string that fails email validation on the next read".
  const {
    replyToEmail,
    confirmationEmailHtml,
    homepageImageUrl,
    homepageVideoUrl,
    homepageTagline,
    linksPageImageUrl,
    linksPageVideoUrl,
    ...rest
  } = parsed.data;
  const updated = await updateOrgSettings({
    ...rest,
    ...(replyToEmail !== undefined ? { replyToEmail: replyToEmail || null } : {}),
    ...(confirmationEmailHtml !== undefined
      ? { confirmationEmailHtml: confirmationEmailHtml ? sanitizeEventDescription(confirmationEmailHtml) : null }
      : {}),
    ...(homepageImageUrl !== undefined ? { homepageImageUrl: homepageImageUrl || null } : {}),
    ...(homepageVideoUrl !== undefined ? { homepageVideoUrl: homepageVideoUrl || null } : {}),
    ...(homepageTagline !== undefined ? { homepageTagline: homepageTagline || null } : {}),
    ...(linksPageImageUrl !== undefined ? { linksPageImageUrl: linksPageImageUrl || null } : {}),
    ...(linksPageVideoUrl !== undefined ? { linksPageVideoUrl: linksPageVideoUrl || null } : {}),
  });
  return NextResponse.json({ ok: true, settings: updated });
}
