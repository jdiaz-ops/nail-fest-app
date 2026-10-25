import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { anotherIdea, approvePiece, editPiece, movePiece, removePiece } from "@/lib/mesa/data";
import { mesaErrorResponse } from "@/lib/mesa/http";

// One piece of La Mesa's bank: «Aprobar», «Otra idea» (this one out for
// good, a new one from Claude in its place), up or down in the order,
// «Quitar» from the bank; and «Editar» (PATCH, the piece's fields).
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const actionSchema = z.object({ action: z.enum(["approve", "another", "remove", "up", "down"]) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    const { action } = parsed.data;
    if (action === "approve") await approvePiece(params.id);
    else if (action === "remove") await removePiece(params.id);
    else if (action === "up" || action === "down") await movePiece(params.id, action);
    else return NextResponse.json({ ok: true, id: (await anotherIdea(params.id)).id });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mesaErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("content" in body)) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  try {
    await editPiece(params.id, (body as { content: unknown }).content);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mesaErrorResponse(error);
  }
}
