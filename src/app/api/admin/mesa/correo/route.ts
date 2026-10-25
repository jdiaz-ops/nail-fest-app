import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { MesaError } from "@/lib/mesa/data";
import { previewHtml } from "@/lib/mesa/sends";

// La Mesa → «Ver el correo»: the edition's email as it
// would go out now (as it went out, once it did), in its own tab.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const edition = Number(req.nextUrl.searchParams.get("edicion"));
  if (!Number.isInteger(edition) || edition < 1) return NextResponse.json({ error: "invalid_edition" }, { status: 400 });
  try {
    return new NextResponse(await previewHtml(edition), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof MesaError)) throw error;
    const message = error.message.replace(/</g, "&lt;");
    return new NextResponse(
      `<!doctype html><meta charset="utf-8"><title>La Mesa</title><body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding:40px;color:#17181c"><h1 style="font-size:20px">Todavía no se puede ver el correo</h1><p>${message}</p></body>`,
      { status: 409, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }
}
