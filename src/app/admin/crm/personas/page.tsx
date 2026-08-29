import Link from "next/link";
import { db } from "@/lib/db";
import { getLifecycleStagesBulk } from "@/lib/personTimeline";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";
import StageBadge from "../StageBadge";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 86_400_000);

export default async function PersonasPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();

  const [people, totalPeople, newLast30Days] = await Promise.all([
    db.person.findMany({
      where: q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { city: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      include: { _count: { select: { registrations: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.person.count(),
    db.person.count({ where: { createdAt: { gte: THIRTY_DAYS_AGO() } } }),
  ]);

  // Real stage per person, computed in a handful of batched queries — see
  // getLifecycleStagesBulk's own comment for why this isn't the same
  // per-row approximation an earlier version of this page used.
  const stageByPerson = await getLifecycleStagesBulk(people.map((p) => p.id));
  const recurrentesTotal = Array.from(stageByPerson.values()).filter((s) => s === "RECURRENTE").length;

  return (
    <div>
      <CrmPageHeader
        title="Personas"
        subtitle="Historial completo por contacto — registros, correos, escaneos de entrada y consentimientos en una sola línea de tiempo."
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Personas totales" value={String(totalPeople)} />
        <StatCard label="Recurrentes (2+ eventos)" value={String(recurrentesTotal)} />
        <StatCard label="Nuevas últimos 30 días" value={String(newLast30Days)} />
      </div>

      <form style={{ marginBottom: 16 }}>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, correo o ciudad…"
          style={{ padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8, width: 320, maxWidth: "100%" }}
        />
      </form>

      <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Correo</th>
              <th style={{ padding: "10px 12px" }}>Ciudad</th>
              <th style={{ padding: "10px 12px" }}>Registros</th>
              <th style={{ padding: "10px 12px" }}>Etapa</th>
              <th style={{ padding: "10px 12px" }}>Cliente desde</th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid #f0efec" }}>
                <td style={{ padding: "10px 12px" }}>
                  <Link href={`/admin/crm/personas/${p.id}`} style={{ fontWeight: 600 }}>
                    {[p.firstName, p.lastName].filter(Boolean).join(" ") || p.email}
                  </Link>
                </td>
                <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{p.email}</td>
                <td style={{ padding: "10px 12px" }}>{p.city ?? "—"}</td>
                <td style={{ padding: "10px 12px" }}>{p._count.registrations}</td>
                <td style={{ padding: "10px 12px" }}>
                  <StageBadge stage={stageByPerson.get(p.id) ?? "LEAD"} />
                </td>
                <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  {p.createdAt.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
                </td>
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  {q ? "Nadie coincide con esa búsqueda." : "Aún no hay personas registradas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
