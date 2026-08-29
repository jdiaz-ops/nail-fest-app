import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Cheap, count-only stage approximation for the list view — the real
// lifecycle computation (getPersonProfile, used on the detail page) also
// needs ScanLog joined per person, which is fine for one profile but not
// for scanning hundreds of rows here. "2+ registros" undercounts real
// "Recurrente" (someone who attended the same event twice counts as 1
// registration) — good enough for a list to scan, not for the real badge.
function approxStageLabel(registrationsCount: number): string {
  if (registrationsCount === 0) return "Lead";
  if (registrationsCount >= 2) return "Recurrente";
  return "Registrado";
}

export default async function PersonasPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const people = await db.person.findMany({
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
  });

  return (
    <div>
      <h1 style={{ fontSize: 20, marginTop: 0 }}>Personas</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 16 }}>
        Historial completo por contacto — registros, correos, escaneos de entrada y consentimientos en una sola línea de tiempo.
      </p>

      <form style={{ marginBottom: 16 }}>
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, correo o ciudad…"
          style={{ padding: "8px 12px", border: "1px solid #e3e1dc", borderRadius: 8, width: 320, maxWidth: "100%" }}
        />
      </form>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e3e1dc" }}>
            <th style={{ padding: 8 }}>Nombre</th>
            <th style={{ padding: 8 }}>Correo</th>
            <th style={{ padding: 8 }}>Ciudad</th>
            <th style={{ padding: 8 }}>Registros</th>
            <th style={{ padding: 8 }}>Etapa</th>
            <th style={{ padding: 8 }}>Cliente desde</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #f0efec" }}>
              <td style={{ padding: 8 }}>
                <Link href={`/admin/crm/personas/${p.id}`} style={{ fontWeight: 600 }}>
                  {[p.firstName, p.lastName].filter(Boolean).join(" ") || p.email}
                </Link>
              </td>
              <td style={{ padding: 8, color: "#5b5f6b" }}>{p.email}</td>
              <td style={{ padding: 8 }}>{p.city ?? "—"}</td>
              <td style={{ padding: 8 }}>{p._count.registrations}</td>
              <td style={{ padding: 8 }}>{approxStageLabel(p._count.registrations)}</td>
              <td style={{ padding: 8, color: "#5b5f6b" }}>
                {p.createdAt.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
              </td>
            </tr>
          ))}
          {people.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 8, color: "#5b5f6b" }}>
                {q ? "Nadie coincide con esa búsqueda." : "Aún no hay personas registradas."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
