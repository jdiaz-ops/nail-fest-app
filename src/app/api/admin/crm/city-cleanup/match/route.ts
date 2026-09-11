import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guard";
import { matchCity } from "@/lib/cityMatch";

// Bounded batch-matching for /admin/crm/ciudades. That page used to call
// matchCity() itself, synchronously, for EVERY distinct raw Person.city
// value in one server-rendered request — the first-letter bucketing in
// cityMatch.ts made each individual call cheap, but nothing bounded the
// TOTAL number of calls, so a production dataset with enough distinct
// messy values (hundreds+, from a historical bulk import) could still
// blow through any request's time budget and never render. This route
// exists so the page can instead fetch matches in small, capped batches
// AFTER it has already rendered — each request's work is bounded by
// MAX_BATCH regardless of how many distinct values exist in total.
//
// Pure CPU, no DB I/O (matchCity() only reads the code-shipped
// COLOMBIA_CITIES list), so a capped batch is cheap and fast — the cap
// is about bounding worst-case latency per request, not about the work
// being expensive per item.
const MAX_BATCH = 300;

const bodySchema = z.object({
  raws: z.array(z.string().min(1)).min(1).max(MAX_BATCH),
});

export async function POST(req: NextRequest) {
  const auth = await requireUser(["ADMIN", "COORDINADOR"]);
  if ("response" in auth) return auth.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues }, { status: 400 });
  }

  const results = parsed.data.raws.map((raw) => {
    const result = matchCity(raw);
    return {
      raw,
      confidence: result.confidence,
      notACity: result.notACity,
      candidates: result.candidates.map((c) => c.label),
      suggested: result.match?.label ?? null,
    };
  });

  return NextResponse.json({ results });
}
