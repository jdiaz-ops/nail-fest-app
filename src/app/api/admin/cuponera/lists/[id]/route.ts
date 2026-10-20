import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { deleteCuponeraList, setCuponeraListVisible, updateCuponeraList } from "@/lib/cuponera/lists";
import { listSchema } from "../schema";

const visibleOnly = z.object({ visible: z.boolean() }).strict();

// The switch sends { visible } alone; the form, the whole list.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const toggle = visibleOnly.safeParse(body);
  try {
    if (toggle.success) {
      const list = await setCuponeraListVisible(params.id, toggle.data.visible);
      return NextResponse.json({ ok: true, list });
    }
    const visible = z.object({ visible: z.boolean() }).safeParse(body);
    const parsed = listSchema.safeParse(body);
    if (!parsed.success || !visible.success) {
      return NextResponse.json({ error: "invalid_body", issues: parsed.success ? [] : parsed.error.issues }, { status: 400 });
    }
    const list = await updateCuponeraList(params.id, { ...parsed.data, visible: visible.data.visible });
    return NextResponse.json({ ok: true, list });
  } catch (err) {
    console.error("update cuponera list failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  try {
    await deleteCuponeraList(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete cuponera list failed", err);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
}
