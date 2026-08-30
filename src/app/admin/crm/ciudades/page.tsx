import { db } from "@/lib/db";
import { matchCity } from "@/lib/cityMatch";
import CrmPageHeader from "../CrmPageHeader";
import StatCard from "../StatCard";
import CityCleanupClient, { type CityCleanupRow } from "./CityCleanupClient";

export const dynamic = "force-dynamic";

// The "hacia atrás" half of city cleanup (the forward half is
// CityAutocomplete.tsx on the live registration form) — every DISTINCT
// raw Person.city value already on file, matched against the same real
// municipality list, for the admin to review and approve merges. Never
// applies anything on its own; see the API route this client posts to.
export default async function CityCleanupPage() {
  const rows = await db.person.groupBy({
    by: ["city"],
    where: { city: { not: null } },
    _count: { _all: true },
  });

  // Skip anything already exactly a canonical label — nothing to review,
  // showing it would just be noise. Everything else (a normalization-only
  // difference, a real typo, a "Ciudad-Departamento" variant, garbage
  // that isn't a city at all) shows up for the admin to decide on.
  const needsReview: CityCleanupRow[] = [];
  for (const r of rows) {
    const raw = r.city;
    if (!raw || !raw.trim()) continue;
    const result = matchCity(raw);
    if (result.confidence === "exact" && result.match?.label === raw) continue;
    needsReview.push({
      raw,
      count: r._count._all,
      confidence: result.confidence,
      notACity: result.notACity,
      candidates: result.candidates.map((c) => c.label),
      suggested: result.match?.label ?? null,
    });
  }
  needsReview.sort((a, b) => b.count - a.count);

  const totalDistinct = rows.length;
  const totalPeopleAffected = needsReview.reduce((sum, r) => sum + r.count, 0);

  return (
    <div>
      <CrmPageHeader
        title="Limpiar ciudades"
        subtitle='Cada valor real de "Ciudad" ya guardado, comparado contra la lista oficial de municipios de Colombia. Revisa cada fila y decide — nada se cambia hasta que apruebes y presiones "Aplicar cambios".'
      />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Valores distintos en la base" value={String(totalDistinct)} />
        <StatCard label="Necesitan revisión" value={String(needsReview.length)} />
        <StatCard label="Personas afectadas" value={String(totalPeopleAffected)} />
      </div>

      <CityCleanupClient rows={needsReview} />
    </div>
  );
}
