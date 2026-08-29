import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCustomQuestion, TYPES_WITH_OPTIONS } from "@/lib/checkoutForm";
import { requireUser } from "@/lib/auth/guard";

// No MARKETING_OPT_IN type — see the CheckoutQuestionType enum's own
// comment in schema.prisma for why that one specifically isn't offered.
const bodySchema = z.object({
  label: z.string().min(1),
  type: z.enum(["TEXT", "SELECT", "RADIO", "CHECKBOX", "DATE", "AGREEMENT"]),
  required: z.boolean().default(false),
  options: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  if (TYPES_WITH_OPTIONS.has(parsed.data.type) && parsed.data.options.filter(Boolean).length < 2) {
    return NextResponse.json({ error: "needs_options" }, { status: 400 });
  }
  const question = await createCustomQuestion(parsed.data);
  return NextResponse.json({ ok: true, question });
}
