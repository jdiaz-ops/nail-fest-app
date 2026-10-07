import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { getEmailBroadcastFailureBreakdown } from "@/lib/broadcasts";
import { csvResponse, toCsv } from "@/lib/csvExport";

export async function GET(_req: NextRequest, { params }: { params: { id: string; broadcastId: string } }) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;
  const broadcast = await db.emailBroadcast.findFirst({ where: { id: params.broadcastId, eventId: params.id } });
  if (!broadcast) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const groups = await getEmailBroadcastFailureBreakdown(broadcast.id);
  const rows: (string | null)[][] = [["nombre", "correo", "estado", "motivo", "accion", "se_reintenta", "detalle"]];
  for (const g of groups) for (const p of g.people) rows.push([p.name, p.email, p.status, g.label, g.action, g.retryable ? "si" : "no", p.detail]);
  return csvResponse(`fallidos-correo-${broadcast.id}.csv`, toCsv(rows));
}
