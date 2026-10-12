import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { reviewCardData } from "@/lib/reviews";
import { reviewCardImage } from "@/lib/reviewCardImage";

// The Instagram card of any review, for the admin.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;
  const card = await reviewCardData(params.id);
  if (!card) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const image = reviewCardImage(card);
  image.headers.set("Content-Disposition", `attachment; filename="resena-${params.id}.png"`);
  return image;
}
