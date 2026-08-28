import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateQuestion, deleteQuestion, TYPES_WITH_OPTIONS } from "@/lib/checkoutForm";

const patchSchema = z.object({
  label: z.string().min(1).optional(),
  required: z.boolean().optional(),
  type: z.enum(["TEXT", "SELECT", "RADIO", "CHECKBOX", "DATE", "AGREEMENT"]).optional(),
  options: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.type && TYPES_WITH_OPTIONS.has(parsed.data.type) && (parsed.data.options ?? []).filter(Boolean).length < 2) {
    return NextResponse.json({ error: "needs_options" }, { status: 400 });
  }
  try {
    const question = await updateQuestion(params.id, parsed.data);
    return NextResponse.json({ ok: true, question });
  } catch (err) {
    console.error("update checkout question failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteQuestion(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("locked")) {
      return NextResponse.json({ error: "locked" }, { status: 403 });
    }
    console.error("delete checkout question failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
