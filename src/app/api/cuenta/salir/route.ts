import { NextRequest, NextResponse } from "next/server";
import { MEMBER_COOKIE, endMemberSession } from "@/lib/community/auth";

// "Cerrar sesión" in her community account.
export async function POST(req: NextRequest) {
  const token = req.cookies.get(MEMBER_COOKIE)?.value;
  if (token) await endMemberSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(MEMBER_COOKIE);
  return res;
}
