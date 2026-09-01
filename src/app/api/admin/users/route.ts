import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const users = await db.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, lastLoginAt: true },
  });
  return NextResponse.json({ users });
}

const createSchema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9._-]+$/, "solo letras, números, punto, guion y guion bajo"),
  name: z.string().trim().max(120).optional(),
  role: z.enum(["ADMIN", "STAFF", "COORDINADOR"]),
  password: z.string().min(8, "mínimo 8 caracteres"),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }
  const { username, name, role, password } = parsed.data;

  const existing = await db.adminUser.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const user = await db.adminUser.create({
    data: { username, name: name || null, role, passwordHash: await hashPassword(password) },
    select: { id: true, username: true, name: true, role: true, active: true, createdAt: true, lastLoginAt: true },
  });
  return NextResponse.json({ user }, { status: 201 });
}
