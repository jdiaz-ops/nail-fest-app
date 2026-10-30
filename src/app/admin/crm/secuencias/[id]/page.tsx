import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz } from "@/lib/dateFormat";
import { segmentPersonIds, type SegmentFilter } from "@/lib/segments/builder";
import { sequenceCounts, sequenceEditorOptions } from "@/lib/sequences/admin";
import { describeDelay } from "@/lib/sequences/shared";
import SequenceEditor from "@/components/SequenceEditor";
import SequenceSwitch from "@/components/SequenceSwitch";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

// One sequence (2026-10-30): on or off, how it's doing — who's on her way,
// who finished, who left the segment, what each step sent — and its editor.
export default async function SequencePage({ params }: { params: { id: string } }) {
  await requirePageUser(["ADMIN"]);
  const sequence = await db.sequence.findUnique({
    where: { id: params.id },
    include: { segment: true, event: { select: { name: true } }, steps: { orderBy: [{ delayMinutes: "asc" }, { position: "asc" }] } },
  });
  if (!sequence) notFound();

  const [options, counts, orgSettings, byStep, recent] = await Promise.all([
    sequenceEditorOptions(),
    sequenceCounts([sequence.id]),
    getOrgSettings(),
    db.sequenceSend.groupBy({ by: ["stepId", "status"], where: { step: { sequenceId: sequence.id } }, _count: { _all: true } }),
    db.sequenceSend.findMany({
      where: { step: { sequenceId: sequence.id } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { step: { select: { id: true, channel: true } }, enrollment: { select: { person: { select: { email: true, firstName: true, lastName: true } } } } },
    }),
  ]);
  const c = counts.get(sequence.id)!;

  // Who would start it if it's turned on now: in the segment, never in this sequence.
  let waiting = 0;
  if (!sequence.enabled) {
    const members = await segmentPersonIds(sequence.segment.filter as unknown as SegmentFilter);
    const known = new Set((await db.sequenceEnrollment.findMany({ where: { sequenceId: sequence.id }, select: { personId: true } })).map((e) => e.personId));
    waiting = members.filter((id) => !known.has(id)).length;
  }

  const stepNumber = new Map(sequence.steps.map((s, i) => [s.id, i + 1]));
  const tally = (stepId: string, status: string) => byStep.find((r) => r.stepId === stepId && r.status === status)?._count._all ?? 0;
  const when = (d: Date) => formatDateInTz(d, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }, orgSettings.timezone, orgSettings.language);
  const tiles: [string, number][] = [
    ["En curso", c.inProgress],
    ["Fuera del segmento ahora", c.out],
    ["Terminaron", c.done],
    ["Salieron del segmento", c.left],
    ["Apartadas al encender", c.setAside],
  ];

  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 13 }}>
        <Link href="/admin/crm/secuencias">← Secuencias</Link>
      </p>
      <CrmPageHeader title={sequence.name} subtitle={`Segmento: ${sequence.segment.name}${sequence.event ? ` · Evento: ${sequence.event.name}` : ""}`} />

      <SequenceSwitch sequenceId={sequence.id} enabled={sequence.enabled} enabledAt={sequence.enabledAt?.toISOString() ?? null} waiting={waiting} />

      <h2 style={{ fontSize: 16, margin: "22px 0 10px" }}>Cómo va</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, maxWidth: 900 }}>
        {tiles.map(([label, n]) => (
          <div key={label} style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 10, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, color: "#5b5f6b" }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{n}</div>
          </div>
        ))}
      </div>
      <div style={{ margin: "14px 0 0", maxWidth: 900, fontSize: 14 }}>
        {sequence.steps.map((s, i) => (
          <div key={s.id} style={{ padding: "8px 0", borderTop: i ? "1px solid #e3e1dc" : "none" }}>
            <strong>
              Paso {i + 1} · {s.channel === "WHATSAPP" ? "WhatsApp" : "Correo"} · {describeDelay(s.delayMinutes).toLowerCase()}
            </strong>
            <span style={{ color: "#5b5f6b" }}>
              {" "}
              — {tally(s.id, "SENT")} enviados · {tally(s.id, "SKIPPED")} omitidos · {tally(s.id, "FAILED")} fallaron
            </span>
          </div>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="admin-table-wrap" style={{ maxWidth: 900, marginTop: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, background: "#fff", border: "1px solid #e3e1dc", borderRadius: 10 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#5b5f6b", fontSize: 12 }}>
                <th style={{ padding: "8px 12px" }}>Cuándo</th>
                <th style={{ padding: "8px 12px" }}>Persona</th>
                <th style={{ padding: "8px 12px" }}>Paso</th>
                <th style={{ padding: "8px 12px" }}>Resultado</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => {
                const p = r.enrollment.person;
                const result =
                  r.status === "SENT" ? "Enviado" : r.status === "SENDING" ? "Enviando…" : `${r.status === "SKIPPED" ? "Omitido" : "Falló"}${r.detail ? `: ${r.detail}` : ""}`;
                return (
                  <tr key={r.id} style={{ borderTop: "1px solid #e3e1dc" }}>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{when(r.createdAt)}</td>
                    <td style={{ padding: "8px 12px" }}>{[p.firstName, p.lastName].filter(Boolean).join(" ") || p.email}</td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {stepNumber.get(r.step.id) ?? "?"} · {r.step.channel === "WHATSAPP" ? "WhatsApp" : "Correo"}
                    </td>
                    <td style={{ padding: "8px 12px", color: r.status === "FAILED" ? "#c2185b" : r.status === "SKIPPED" ? "#5b5f6b" : "inherit" }}>{result}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: 16, margin: "28px 0 10px" }}>Editar</h2>
      <SequenceEditor
        sequence={{
          id: sequence.id,
          name: sequence.name,
          segmentId: sequence.segmentId,
          eventId: sequence.eventId,
          steps: sequence.steps.map((s) => ({
            id: s.id,
            channel: s.channel,
            delayMinutes: s.delayMinutes,
            subject: s.subject,
            bodyHtml: s.bodyHtml,
            buttonText: s.buttonText,
            buttonTarget: s.buttonTarget,
            templateId: s.templateId,
            variableMapping: (s.variableMapping as Record<string, string> | null) ?? null,
          })),
        }}
        options={options}
      />
    </div>
  );
}
