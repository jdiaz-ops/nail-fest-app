import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { destroySessionsForUser } from "@/lib/auth/session";

const patchSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8, "mínimo 8 caracteres").optional(),
});

// Refuses to leave the account table with zero usable ADMIN accounts — the
// only way back in from there would be direct DB access, which this
// session doesn't have against production. Applies to both demoting the
// last admin to STAFF and deactivating/deleting them.
async function wouldRemoveLastActiveAdmin(userId: string, becomingNonAdmin: boolean): Promise<boolean> {
  if (!becomingNonAdmin) return false;
  const otherActiveAdmins = await db.adminUser.count({
    where: { id: { not: userId }, role: "ADMIN", active: true },
  });
  return otherActiveAdmins === 0;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { name, role, active, password } = parsed.data;

  const target = await db.adminUser.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const becomingNonAdmin = (role !== undefined && role !== "ADMIN") || active === false;
  if (target.role === "ADMIN" && (await wouldRemoveLastActiveAdmin(target.id, becomingNonAdmin))) {
    return NextResponse.json({ error: "last_admin" }, { status: 409 });
  }

  const data: { name?: string | null; role?: "ADMIN" | "STAFF"; active?: boolean; passwordHash?: string } = {};
  if (name !== undefined) data.name = name || null;
  if (role !== undefined) data.role = role;
  if (active !== undefined) data.active = active;
  if (password !== undefined) data.passwordHash = await hashPassword(password);

  const user = await db.adminUser.update({
    where: { id: target.id },
    data,
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, lastLoginAt: true },
  });

  // A deactivation or password reset should cut off whatever's already
  // logged in right now, not wait for that session's own long expiry (see
  // lib/auth/session.ts's SESSION_DAYS) — a role change alone doesn't need
  // this, since every request re-reads the role live from the DB anyway.
  if (active === false || password !== undefined) {
    await destroySessionsForUser(target.id);
  }

  return NextResponse.json({ user });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const target = await db.adminUser.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (target.id === auth.user.id) {
    return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  }
  if (target.role === "ADMIN" && (await wouldRemoveLastActiveAdmin(target.id, true))) {
    return NextResponse.json({ error: "last_admin" }, { status: 409 });
  }

  await db.adminUser.delete({ where: { id: target.id } }); // cascades to AdminSession
  return NextResponse.json({ ok: true });
}
