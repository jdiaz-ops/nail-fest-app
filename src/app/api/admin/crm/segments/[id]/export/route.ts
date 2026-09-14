import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { resolveSegment, type SegmentFilter } from "@/lib/segments/builder";
import { findCountry } from "@/lib/worldCountries";

// Same audience a broadcast to this segment would actually reach —
// resolveSegment is the one place that logic lives (builder.ts), so this
// is guaranteed to match what Difusiones/Broadcasts would send to, not a
// second copy of the filter logic that could drift. Real-world use:
// pulling a segment into a spreadsheet for someone outside this app
// (a caller list for the door team, a one-off analysis) — not itself a
// send, so it isn't gated on any consent purpose the way an actual
// broadcast is; whoever downloads this is responsible for what they do
// with it next, same as any CRM export.
export const maxDuration = 60;

function csvCell(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? "" : String(value);
  // RFC4180: quote whenever the cell contains a comma, quote, or newline;
  // an embedded quote doubles.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const segment = await db.segmentDefinition.findUnique({ where: { id: params.id } });
  if (!segment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const people = await resolveSegment(segment.filter as unknown as SegmentFilter);

  const header = ["Nombre", "Apellido", "Correo", "Teléfono", "Ciudad", "País", "Profesión", "Fecha de registro"];
  const rows = people.map((p) =>
    [
      p.firstName,
      p.lastName,
      p.email,
      p.phone,
      p.city,
      p.country ? (findCountry(p.country)?.name ?? p.country) : null,
      p.profession,
      p.createdAt.toISOString().slice(0, 10),
    ]
      .map(csvCell)
      .join(",")
  );
  // Leading BOM so Excel (the realistic destination for a "descargar CSV"
  // click) reads UTF-8 accents (Bogotá, Rodríguez) correctly instead of
  // mangling them — harmless to any other CSV reader.
  const csv = "﻿" + [header.map(csvCell).join(","), ...rows].join("\r\n") + "\r\n";

  // Filename built from the segment's own name — sanitized to something
  // every OS/browser accepts as a bare filename (no slashes, no quotes).
  const safeName = segment.name.replace(/[^\p{L}\p{N}\s._-]/gu, "").trim().replace(/\s+/g, "-") || "segmento";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}.csv"`,
    },
  });
}
