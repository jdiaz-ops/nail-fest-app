import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeUsername, usernameProblem } from "@/lib/library/portal";

// "Disponible" next to the username box while she types.
export async function GET(req: NextRequest) {
  const username = normalizeUsername(req.nextUrl.searchParams.get("u") ?? "");
  const problem = usernameProblem(username);
  if (problem) return NextResponse.json({ username, available: false, message: problem });
  const taken = await db.instructor.findUnique({ where: { slug: username }, select: { id: true } });
  return NextResponse.json({ username, available: !taken, message: taken ? "Ese usuario ya existe. Prueba otro." : null });
}
