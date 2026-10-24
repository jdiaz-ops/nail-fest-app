import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { csvResponse, toCsv } from "@/lib/csvExport";
import { LEAD_KIND_LABELS, LIBRARY_LEAD_KINDS, type LibraryLeadKindKey } from "@/lib/library/leads";

const dateFormatter = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" });

// Editar biblioteca → Registros → "Descargar CSV": every registration and
// request (or one kind, ?tipo=REGISTRO), newest first.
export async function GET(req: NextRequest) {
  const auth = await requireUser(["ADMIN"]);
  if ("response" in auth) return auth.response;

  const kind = req.nextUrl.searchParams.get("tipo");
  const leads = await db.libraryLead.findMany({
    where: (LIBRARY_LEAD_KINDS as readonly string[]).includes(kind ?? "") ? { kind: kind as LibraryLeadKindKey } : {},
    orderBy: { createdAt: "desc" },
    include: { instructor: { select: { name: true } } },
  });
  const rows = [
    ["Fecha", "Tipo", "Nombre", "Correo", "WhatsApp", "Ciudad", "Marca", "Instructora", "Detalle", "Mensaje", "Acepta novedades", "Atendido"],
    ...leads.map((l) => [
      dateFormatter.format(l.createdAt),
      LEAD_KIND_LABELS[l.kind],
      l.name,
      l.email,
      l.phone,
      l.city,
      l.company,
      l.instructor?.name,
      l.context,
      l.message,
      l.marketingConsent ? "Sí" : "No",
      l.handled ? "Sí" : "No",
    ]),
  ];
  return csvResponse(`biblioteca-registros${kind ? `-${kind.toLowerCase()}` : ""}.csv`, toCsv(rows));
}
