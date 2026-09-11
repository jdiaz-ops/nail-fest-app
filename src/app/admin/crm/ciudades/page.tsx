import { db } from "@/lib/db";
import CrmPageHeader from "../CrmPageHeader";
import CityCleanupClient from "./CityCleanupClient";

export const dynamic = "force-dynamic";

// The "hacia atrás" half of city cleanup (the forward half is
// CityAutocomplete.tsx on the live registration form) — every DISTINCT
// raw Person.city value already on file, matched against the same real
// municipality list, for the admin to review and approve merges. Never
// applies anything on its own; see the API route this client posts to.
//
// This page's OWN work is now deliberately bounded: the only thing it
// does server-side at render time is db.person.groupBy() — cheap no
// matter how many distinct raw city values exist. Actually matching each
// value against the canonical list (matchCity(), the expensive part —
// see cityMatch.ts's own comment) used to run for every single one of
// them right here, synchronously, before the page could render at all.
// On real production data (a bulk-imported CRM with hundreds of
// genuinely garbled raw values, not a handful) that meant the page could
// simply never finish loading, however cheap each individual match got —
// nothing bounded the TOTAL number of matches one request computed. Now
// CityCleanupClient fetches matches in small capped batches from
// /api/admin/crm/city-cleanup/match AFTER the page has already rendered,
// so this page's own response time no longer depends on how messy the
// real data is.
export default async function CityCleanupPage() {
  const rows = await db.person.groupBy({
    by: ["city"],
    where: { city: { not: null } },
    _count: { _all: true },
  });

  const allRaw = rows
    .map((r) => ({ raw: (r.city ?? "").trim(), count: r._count._all }))
    .filter((r) => r.raw.length > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <CrmPageHeader
        title="Limpiar ciudades"
        subtitle='Cada valor real de "Ciudad" ya guardado, comparado contra la lista oficial de municipios de Colombia. Revisa cada fila y decide — nada se cambia hasta que apruebes y presiones "Aplicar cambios".'
      />

      <CityCleanupClient allRaw={allRaw} />
    </div>
  );
}
