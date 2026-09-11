import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { findCountry } from "@/lib/worldCountries";
import { getLifecycleStagesBulk } from "@/lib/personTimeline";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";
import StageBadge from "../StageBadge";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 86_400_000);

export default async function PersonasPage({
  searchParams,
}: {
  searchParams: { q?: string; city?: string; profession?: string; country?: string };
}) {
  const q = searchParams.q?.trim();
  const cityFilter = searchParams.city?.trim();
  const professionFilter = searchParams.profession?.trim();
  const countryFilter = searchParams.country?.trim();

  // Every filter is optional and combines with AND (ciudad = Bucaramanga
  // Y profesión = Manicurista) — same posture as Segmentos' own builder,
  // just a fixed set of fields here rather than the full condition list.
  const where: Prisma.PersonWhereInput = {};
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
    ];
  }
  if (cityFilter) where.city = cityFilter;
  if (professionFilter) where.profession = professionFilter;
  if (countryFilter) where.country = countryFilter;

  const [people, totalPeople, newLast30Days, cityRows, professionRows, countryRows] = await Promise.all([
    db.person.findMany({
      where,
      include: { _count: { select: { registrations: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.person.count(),
    db.person.count({ where: { createdAt: { gte: THIRTY_DAYS_AGO() } } }),
    // Real values already on file, not the configured checkout-form
    // option lists — same reasoning as Segmentos' own city filter: a
    // dropdown listing an option nobody actually has would just be a
    // dead end. Distinct here, not resolveSegment/countSegment (there's
    // no saved SegmentFilter involved, just plain equality filters).
    db.person.findMany({ where: { city: { not: null } }, select: { city: true }, distinct: ["city"] }),
    db.person.findMany({ where: { profession: { not: null } }, select: { profession: true }, distinct: ["profession"] }),
    db.person.findMany({ where: { country: { not: null } }, select: { country: true }, distinct: ["country"] }),
  ]);
  const cityOptions = cityRows
    .map((r) => r.city)
    .filter((c): c is string => !!c && c.trim().length > 0)
    .sort((a, b) => a.localeCompare(b, "es"));
  const professionOptions = professionRows
    .map((r) => r.profession)
    .filter((p): p is string => !!p && p.trim().length > 0)
    .sort((a, b) => a.localeCompare(b, "es"));
  // ISO2 -> real country name (lib/worldCountries.ts) for display — the
  // dropdown VALUE stays the ISO2 code (matches Person.country and the
  // segment filter's own `countries`), only the LABEL is the human name.
  const countryOptions = countryRows
    .map((r) => r.country)
    .filter((c): c is string => !!c)
    .map((iso2) => ({ iso2, name: findCountry(iso2)?.name ?? iso2 }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Real stage per person, computed in a handful of batched queries — see
  // getLifecycleStagesBulk's own comment for why this isn't the same
  // per-row approximation an earlier version of this page used.
  const stageByPerson = await getLifecycleStagesBulk(people.map((p) => p.id));
  const recurrentesTotal = Array.from(stageByPerson.values()).filter((s) => s === "RECURRENTE").length;

  const hasAnyFilter = Boolean(q || cityFilter || professionFilter || countryFilter);

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

      <form style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, correo o ciudad…"
          style={{ padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8, width: 260, maxWidth: "100%" }}
        />
        <select name="city" defaultValue={cityFilter ?? ""} style={{ padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8 }}>
          <option value="">Todas las ciudades</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="profession"
          defaultValue={professionFilter ?? ""}
          style={{ padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8 }}
        >
          <option value="">Todas las profesiones</option>
          {professionOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select name="country" defaultValue={countryFilter ?? ""} style={{ padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8 }}>
          <option value="">Todos los países</option>
          {countryOptions.map((c) => (
            <option key={c.iso2} value={c.iso2}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="primary" style={{ width: "auto", padding: "8px 16px" }}>
          Filtrar
        </button>
        {hasAnyFilter && (
          <Link href="/admin/crm/personas" style={{ fontSize: 13 }}>
            Quitar filtros
          </Link>
        )}
      </form>

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Correo</th>
              <th style={{ padding: "10px 12px" }}>Ciudad</th>
              <th style={{ padding: "10px 12px" }}>País</th>
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
                <td style={{ padding: "10px 12px" }}>{p.country ? findCountry(p.country)?.name ?? p.country : "—"}</td>
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
                <td colSpan={7} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  {hasAnyFilter ? "Nadie coincide con esa búsqueda/filtro." : "Aún no hay personas registradas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
