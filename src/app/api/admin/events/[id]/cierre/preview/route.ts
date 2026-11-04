import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { imparablesClosingSample } from "@/lib/imparables/closing";

export const dynamic = "force-dynamic";

// The preview of Manicuristas Imparables' closing email (lib/imparables/closingEmail.ts), with sample data, for
// «Después del pago» → «Correo de cierre». Nothing is sent.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const event = await db.event.findUnique({ where: { id: params.id } });
  if (!event || event.theme !== "IMPARABLES") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const email = await imparablesClosingSample(event);
  return new NextResponse(email.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
