import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { createAndSubmitTemplate, TemplateValidationError } from "@/lib/whatsapp/templates";

const buttonSchema = z.union([
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().min(1) }),
  z.object({ type: z.literal("URL"), text: z.string().min(1), url: z.string().url(), urlExample: z.string().min(1).optional() }),
  z.object({ type: z.literal("PHONE_NUMBER"), text: z.string().min(1), phoneNumber: z.string().min(1) }),
]);

const bodySchema = z.object({
  name: z.string().min(1),
  language: z.string().min(1),
  category: z.enum(["MARKETING", "UTILITY"]),
  headerText: z.string().optional(),
  bodyText: z.string().min(1),
  bodyExamples: z.array(z.string()),
  footerText: z.string().optional(),
  buttons: z.array(buttonSchema).optional(),
});

// Creates a template directly in Meta's WhatsApp Manager (submits it for
// review) and mirrors it locally right away, status PENDING — see
// lib/whatsapp/templates.ts's createAndSubmitTemplate for why there's no
// local-only draft state.
export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const template = await createAndSubmitTemplate(parsed.data);
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    if (err instanceof TemplateValidationError) {
      return NextResponse.json({ error: "validation_failed", message: err.message }, { status: 400 });
    }
    console.error("whatsapp template creation failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "creation_failed" }, { status: 502 });
  }
}
