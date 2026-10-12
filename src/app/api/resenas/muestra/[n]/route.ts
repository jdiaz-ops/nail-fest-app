import { NextRequest, NextResponse } from "next/server";

// A placeholder "photo" for sample reviews (lib/reviews.ts's
// createSampleReviews): a flat brand-colored card that says what it is,
// so no real person's picture is ever needed to preview the blocks.
const PALETTE = [
  ["#ffc5a8", "#1c1310"],
  ["#b9ece8", "#0b2e2c"],
  ["#e9e4f6", "#1c1310"],
  ["#ffe3a3", "#1c1310"],
  ["#f6d5e3", "#1c1310"],
  ["#d9efd3", "#0b2e2c"],
];

export async function GET(_req: NextRequest, { params }: { params: { n: string } }) {
  const n = Math.max(1, Math.min(PALETTE.length, Number.parseInt(params.n, 10) || 1));
  const [bg, ink] = PALETTE[n - 1]!;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="${bg}"/><circle cx="640" cy="150" r="60" fill="${ink}" fill-opacity="0.08"/><circle cx="180" cy="470" r="110" fill="${ink}" fill-opacity="0.08"/><text x="40" y="548" font-family="Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="${ink}">Foto de muestra ${n}</text></svg>`;
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" } });
}
