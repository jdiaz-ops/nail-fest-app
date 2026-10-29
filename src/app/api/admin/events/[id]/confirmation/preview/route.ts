import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { imparablesConfirmationPreview } from "@/lib/imparables/confirmation";

export const dynamic = "force-dynamic";

// «Confirmación del evento»'s preview of Manicuristas Imparables' designed
// email (2026-10-29): as a buyer at today's price would get it, with a
// sample name and code. Nothing is sent.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const email = await imparablesConfirmationPreview(params.id);
  if (!email) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(email.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
