import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { versionQrUrl } from "@/lib/imparables/versions";

export const dynamic = "force-dynamic";

// A version's QR to print (2026-10-30): its link with its own utm_ tags, as
// a PNG or as an SVG for the print shop. «principal»: the main page's.
// `?ver=1` shows it instead of downloading it (the editor's preview).
export async function GET(req: NextRequest, { params }: { params: { id: string; versionId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const event = await db.event.findUnique({ where: { id: params.id }, select: { slug: true } });
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let slug: string | null = null;
  if (params.versionId !== "principal") {
    const version = await db.landingVersion.findUnique({ where: { id: params.versionId }, select: { slug: true, eventId: true } });
    if (!version || version.eventId !== params.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
    slug = version.slug;
  }
  const url = versionQrUrl(event.slug, slug);
  const name = `qr-${slug ?? event.slug}`;
  const inline = req.nextUrl.searchParams.get("ver") === "1";
  const disposition = (ext: string) => (inline ? "inline" : `attachment; filename="${name}.${ext}"`);
  const colors = { dark: "#141414", light: "#ffffff" };

  if (req.nextUrl.searchParams.get("formato") === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, errorCorrectionLevel: "M", color: colors });
    return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Content-Disposition": disposition("svg"), "Cache-Control": "no-store" } });
  }
  const png = await QRCode.toBuffer(url, { type: "png", width: 1200, margin: 2, errorCorrectionLevel: "M", color: colors });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": disposition("png"), "Cache-Control": "no-store" } });
}
