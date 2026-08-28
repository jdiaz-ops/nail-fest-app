import { db } from "@/lib/db";
import BroadcastComposer from "@/components/BroadcastComposer";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const [events, professionOptions, broadcasts] = await Promise.all([
    db.event.findMany({ orderBy: { startsAt: "asc" } }),
    db.professionOption.findMany({ where: { active: true }, orderBy: { label: "asc" } }),
    db.emailBroadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { segment: true, _count: { select: { logs: true } } },
    }),
  ]);

  return (
    <div>
      <BroadcastComposer events={events} professionOptions={professionOptions.map((p) => p.label)} />

      <h2 style={{ marginTop: 40 }}>Historial</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc" }}>
            <th style={{ padding: 8 }}>Asunto</th>
            <th style={{ padding: 8 }}>Segmento</th>
            <th style={{ padding: 8 }}>Estado</th>
            <th style={{ padding: 8 }}>Enviados</th>
          </tr>
        </thead>
        <tbody>
          {broadcasts.map((b) => (
            <tr key={b.id} style={{ borderBottom: "1px solid #f0efec" }}>
              <td style={{ padding: 8 }}>{b.subject}</td>
              <td style={{ padding: 8 }}>{b.segment.name}</td>
              <td style={{ padding: 8 }}>{b.status}</td>
              <td style={{ padding: 8 }}>{b._count.logs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
