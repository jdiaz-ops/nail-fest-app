import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { sequenceCounts } from "@/lib/sequences/admin";
import { describeDelay } from "@/lib/sequences/shared";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

// CRM → Secuencias (2026-10-30): the automatic follow-ups — a WhatsApp and
// emails for the people of a segment, the abandoned carts first. Each one
// with how it's doing. See lib/sequences/engine.ts.
export default async function SequencesPage() {
  await requirePageUser(["ADMIN"]);
  const sequences = await db.sequence.findMany({
    orderBy: { createdAt: "desc" },
    include: { segment: { select: { name: true } }, event: { select: { name: true } }, steps: { orderBy: [{ delayMinutes: "asc" }, { position: "asc" }] } },
  });
  const counts = await sequenceCounts(sequences.map((s) => s.id));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <CrmPageHeader
          title="Secuencias"
          subtitle="Mensajes que salen solos a las personas de un segmento: WhatsApp y correos, cada uno tanto tiempo después de que entra. Si sale del segmento (por ejemplo, porque compró), no le llega nada más."
        />
        <Link href="/admin/crm/secuencias/nueva" className="primary" style={{ whiteSpace: "nowrap", padding: "10px 18px", borderRadius: 8, background: "#00beb5", color: "#0b2e2c", fontWeight: 600, textDecoration: "none" }}>
          + Nueva secuencia
        </Link>
      </div>

      {sequences.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #e3e1dc", borderRadius: 12, padding: 20, fontSize: 14, color: "#5b5f6b", maxWidth: 720 }}>
          Todavía no hay secuencias. Para los carritos abandonados, arma primero su segmento en <Link href="/admin/crm/segments">Segmentos</Link> con «Carrito
          abandonado en estos eventos», y luego crea aquí la secuencia con ese segmento.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
          {sequences.map((s) => {
            const c = counts.get(s.id)!;
            return (
              <Link
                key={s.id}
                href={`/admin/crm/secuencias/${s.id}`}
                style={{ display: "block", background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "16px 18px", color: "inherit", textDecoration: "none" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16 }}>{s.name}</strong>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "2px 9px",
                      borderRadius: 999,
                      color: s.enabled ? "#1f7a4d" : "#6b6f7a",
                      background: s.enabled ? "#e6f4ec" : "#eceae6",
                    }}
                  >
                    {s.enabled ? "Encendida" : "Apagada"}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, color: "#5b5f6b", marginTop: 4 }}>
                  Segmento: {s.segment.name}
                  {s.event ? ` · Evento: ${s.event.name}` : ""}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {s.steps.map((step) => (
                    <span key={step.id} style={{ fontSize: 12.5, padding: "3px 10px", borderRadius: 6, background: "#f0efec" }}>
                      {step.channel === "WHATSAPP" ? "WhatsApp" : "Correo"} · {describeDelay(step.delayMinutes).toLowerCase()}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#5b5f6b", marginTop: 10 }}>
                  {c.inProgress} en curso · {c.done} terminaron · {c.left} salieron del segmento · {c.sent} mensajes enviados
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
