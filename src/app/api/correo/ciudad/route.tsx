import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { LETTERING, letterable, letteringBox, letteringSigned } from "@/lib/nailfest/cityLettering";

// The city in Nail Fest's script for its emails' header (lib/nailfest/
// cityLettering.ts, 2026-10-30): a PNG at 2×, transparent, its box measured
// there so the email's <img> keeps its proportions. Only a city we signed;
// the same one is the same picture, cached for good (next/og's own headers:
// a year, immutable). The font ships with the
// API functions (next.config.js' outputFileTracingIncludes).

let font: Promise<Buffer> | null = null;

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("c") ?? "";
  if (!letterable(city) || !letteringSigned(city, req.nextUrl.searchParams.get("s") ?? "")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  font ??= readFile(path.join(process.cwd(), "src/lib/nailfest/fonts/Satisfy-Regular.ttf"));
  let data: Buffer;
  try {
    data = await font;
  } catch (err) {
    font = null;
    throw err;
  }
  const box = letteringBox(city, LETTERING.size);
  const x2 = (n: number) => n * 2;
  return new ImageResponse(
    (
      <div style={{ width: x2(box.width), height: x2(box.height), display: "flex", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: x2(box.left),
            top: x2(box.top),
            display: "flex",
            fontFamily: LETTERING.font,
            fontSize: x2(LETTERING.size),
            lineHeight: `${x2(box.lineHeight)}px`,
            color: LETTERING.color,
            whiteSpace: "nowrap",
          }}
        >
          {city}
        </div>
      </div>
    ),
    {
      width: x2(box.width),
      height: x2(box.height),
      fonts: [{ name: LETTERING.font, data, weight: 400, style: "normal" }],
    }
  );
}
