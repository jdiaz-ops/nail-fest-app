import { NextRequest, NextResponse } from "next/server";

// Simple shared-password gate on /admin/* — enough until Phase 05 (real
// per-person roles/permissions). Browser prompts for username/password via
// standard HTTP Basic Auth; no login page to build for this stage.

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USERNAME;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    // Fail closed, not open: if the credentials aren't configured, block
    // access rather than silently leaving /admin public.
    return new NextResponse("Admin auth not configured (ADMIN_USERNAME/ADMIN_PASSWORD).", {
      status: 503,
    });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const [suppliedUser, suppliedPass] = decoded.split(":");
    if (suppliedUser === user && suppliedPass === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticación requerida", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Nail Fest Admin"' },
  });
}

export const config = {
  // Covers both the admin pages and their supporting /api/admin/* routes
  // (e.g. the Meta connection form's save endpoint) under the same gate.
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
