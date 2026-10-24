import { NextRequest, NextResponse } from "next/server";
import { INSTRUCTOR_COOKIE, endInstructorSession } from "@/lib/library/portalAuth";

// "Cerrar sesión" in the portal.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(INSTRUCTOR_COOKIE)?.value;
  if (token) await endInstructorSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(INSTRUCTOR_COOKIE);
  return res;
}
