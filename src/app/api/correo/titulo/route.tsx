import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { LETTERINGS, LETTERING_FONT, isLetteringKind, letterable, letteringBox, letteringSigned } from "@/lib/nailfest/titleLettering";

// The event's name or days for its emails' header, as its page writes them
// (lib/nailfest/titleLettering.ts, 2026-10-30): a PNG at 2×, transparent,
// its box measured there so the email's <img> keeps its proportions. Only a
// text we signed; the same one is the same picture, cached for good (next/og's
// own headers: a year, immutable). The font ships with this route
// (next.config.js' outputFileTracingIncludes).

let font: Promise<Buffer> | null = null;

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("k");
  const text = req.nextUrl.searchParams.get("t") ?? "";
  if (!isLetteringKind(kind) || !letterable(text) || !letteringSigned(kind, text, req.nextUrl.searchParams.get("s") ?? "")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  font ??= readFile(path.join(process.cwd(), "src/lib/nailfest/fonts/Fraunces-Black.ttf"));
  let data: Buffer;
  try {
    data = await font;
  } catch (err) {
    font = null;
    throw err;
  }
  const { size, color, tracking } = LETTERINGS[kind];
  const box = letteringBox(kind, text);
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
            fontFamily: LETTERING_FONT,
            fontWeight: 900,
            fontSize: x2(size),
            lineHeight: `${x2(box.lineHeight)}px`,
            letterSpacing: `${x2((size * tracking) / 1000)}px`,
            color,
            whiteSpace: "nowrap",
          }}
        >
          {text}
        </div>
      </div>
    ),
    {
      width: x2(box.width),
      height: x2(box.height),
      fonts: [{ name: LETTERING_FONT, data, weight: 900, style: "normal" }],
    }
  );
}
