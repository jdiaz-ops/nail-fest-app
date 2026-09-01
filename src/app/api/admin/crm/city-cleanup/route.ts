import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { isKnownCityLabel } from "@/lib/cityMatch";

// The "hacia atrás" half of the city cleanup — /admin/crm/ciudades shows a
// reviewed preview of raw Person.city values matched against the real
// municipality list; this applies whatever the admin actually approved.
// Never runs automatically, never on its own judgment — see
// CityCleanupClient.tsx for the review step this always comes after.
const bodySchema = z.object({
  mappings: z
    .array(
      z.object({
        raw: z.string().min(1),
        // null = "vaciar" (blank out a value that isn't a real city at
        // all, e.g. a cédula number that landed in this column).
        newValue: z.string().min(1).nullable(),
      })
    )
    .min(1),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  // Guard against introducing NEW garbage during the cleanup itself — a
  // newValue must be a real canonical label, same rule the live
  // registration form enforces going forward (see /api/register).
  for (const m of parsed.data.mappings) {
    if (m.newValue !== null && !isKnownCityLabel(m.newValue)) {
      return NextResponse.json({ error: "invalid_city", raw: m.raw, newValue: m.newValue }, { status: 400 });
    }
  }

  const results = await db.$transaction(
    parsed.data.mappings.map((m) => db.person.updateMany({ where: { city: m.raw }, data: { city: m.newValue } }))
  );

  const totalUpdated = results.reduce((sum, r) => sum + r.count, 0);
  return NextResponse.json({
    ok: true,
    totalUpdated,
    perMapping: parsed.data.mappings.map((m, i) => ({ raw: m.raw, newValue: m.newValue, count: results[i]!.count })),
  });
}
