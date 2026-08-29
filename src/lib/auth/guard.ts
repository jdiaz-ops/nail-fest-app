import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

/**
 * For Route Handlers (/api/admin/*) — there's no shared "layout" for API
 * routes the way pages get one, so each handler calls this itself. Returns
 * either the resolved user or a ready-to-return NextResponse for the
 * caller to short-circuit on:
 *
 *   const auth = await requireUser(["ADMIN"]);
 *   if ("response" in auth) return auth.response;
 *   const { user } = auth;
 */
export async function requireUser(
  allowedRoles?: CurrentUser["role"][]
): Promise<{ user: CurrentUser } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { response: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * For Server Component pages/layouts under /admin — the authoritative
 * gate (middleware can't touch Postgres, see the removed middleware.ts's
 * git history). Redirects to /login when logged out, or to whichever
 * section that role IS allowed into when logged in but out of scope —
 * never a dead-end error page.
 */
export async function requirePageUser(allowedRoles?: CurrentUser["role"][]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    redirect(user.role === "STAFF" ? "/admin/scan" : "/admin");
  }
  return user;
}
