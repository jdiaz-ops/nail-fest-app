import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getBroadcastFailureBreakdown } from "@/lib/whatsapp/broadcasts";
import { csvResponse, toCsv } from "@/lib/csvExport";

// The failure breakdown as a spreadsheet — one row per number, with its
// group and what to do, for cleaning the CRM outside the app.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const groups = await getBroadcastFailureBreakdown(params.id);
  const rows: (string | null)[][] = [["nombre", "celular", "motivo", "accion", "se_reintenta", "detalle"]];
  for (const g of groups) for (const p of g.people) rows.push([p.name, p.phone, g.label, g.action, g.retryable ? "si" : "no", p.detail]);
  return csvResponse(`fallidos-whatsapp-${params.id}.csv`, toCsv(rows));
}
