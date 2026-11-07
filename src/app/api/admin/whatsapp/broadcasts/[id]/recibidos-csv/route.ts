import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { csvResponse, toCsv } from "@/lib/csvExport";
import { NotReachedError, difusionOutcomes } from "@/lib/whatsapp/notReached";

// Difusiones → «Quién la recibió (CSV)» (2026-11-07): everyone its segment holds, with how it went for their
// number — recibió, falló, no se le envió.
export const maxDuration = 60;

const WORDS = { received: "recibio", failed: "fallo", none: "no_se_le_envio" } as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  try {
    const { people, template } = await difusionOutcomes(params.id);
    const rows: (string | null)[][] = [["nombre", "celular", "correo", "estado"]];
    for (const { person, outcome } of people) {
      rows.push([[person.firstName, person.lastName].filter(Boolean).join(" "), person.phone, person.email, WORDS[outcome]]);
    }
    return csvResponse(`difusion-${template}-quien-la-recibio.csv`, toCsv(rows));
  } catch (error) {
    if (!(error instanceof NotReachedError)) throw error;
    return NextResponse.json({ error: "not_reached", message: error.message }, { status: 400 });
  }
}
