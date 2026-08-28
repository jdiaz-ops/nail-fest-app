import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { verifyQrToken } from "@/lib/ticket";

// Serves the QR as a normal image URL. Needed because email clients
// (Gmail included) block base64 data: URIs in <img src> — they render fine
// in a browser preview but silently fail to load in an actual inbox. This
// endpoint is intentionally public/unauthenticated: the token it takes IS
// the ticket credential, so anyone who could render this image already has
// everything needed to regenerate it themselves — no new exposure.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const { valid } = verifyQrToken(params.token);
  if (!valid) {
    return NextResponse.json({ error: "invalid_token" }, { status: 404 });
  }

  const png = await QRCode.toBuffer(params.token, { errorCorrectionLevel: "M", margin: 1, width: 480 });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
