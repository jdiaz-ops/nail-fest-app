import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { HYGIENE_LABELS, hygieneSummary } from "@/lib/contactHygiene";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

const EXPLAIN: Record<string, string> = {
  [HYGIENE_LABELS.invalidPhone]: "Meta dijo que el número no tiene WhatsApp o está mal escrito. Ya no reciben WhatsApp. Corrige el celular en el perfil para reactivarlos.",
  [HYGIENE_LABELS.invalidEmail]: "El correo rebotó duro o el proveedor lo rechazó. Ya no reciben correos de marketing. Corrige la dirección para reactivarlos.",
  [HYGIENE_LABELS.spamComplaint]: "Marcaron un correo nuestro como spam. No volver a escribirles.",
  [HYGIENE_LABELS.metaBlocked]: "Meta frenó un mensaje de marketing hacia ellos. No hay nada que corregir: entran en la siguiente difusión.",
};

// Contacts the app flagged on its own (lib/contactHygiene.ts) — what used
// to hide inside a "fallidos" percentage, as a list you can act on.
export default async function LimpiezaPage() {
  await requirePageUser(["ADMIN", "COORDINADOR"]);
  const summary = await hygieneSummary();
  const lists = await Promise.all(
    summary.map(async (s) =>
      s.count === 0
        ? []
        : db.person.findMany({
            where: { labels: { some: { name: s.label } } },
            select: { id: true, firstName: true, lastName: true, phone: true, email: true, city: true },
            orderBy: { updatedAt: "desc" },
            take: 300,
          })
    )
  );
  return (
    <div>
      <CrmPageHeader title="Limpieza automática" subtitle="Contactos que la app etiquetó sola al comprobar que un dato está muerto. Lo único manual que queda es corregir el dato en el perfil cuando lo tengas." />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        {summary.map((s) => (
          <div key={s.label} style={{ border: "1px solid #e8e6e1", borderRadius: 12, padding: "10px 14px", minWidth: 150, background: "#fff" }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{s.count.toLocaleString("es-CO")}</div>
            <div style={{ fontSize: 12, color: "#5b5f6b" }}>{s.label}</div>
          </div>
        ))}
      </div>
      {summary.map((s, i) =>
        s.count === 0 ? null : (
          <section key={s.label} style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>
              {s.label} · {s.count.toLocaleString("es-CO")}
            </h2>
            <p style={{ fontSize: 13, color: "#5b5f6b", margin: "0 0 10px", maxWidth: 720 }}>{EXPLAIN[s.label]}</p>
            <div style={{ overflowX: "auto", border: "1px solid #e8e6e1", borderRadius: 12, background: "#fff" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#8a8478", fontSize: 11 }}>
                    <th style={{ padding: "8px 12px" }}>Nombre</th>
                    <th style={{ padding: "8px 12px" }}>Celular</th>
                    <th style={{ padding: "8px 12px" }}>Correo</th>
                    <th style={{ padding: "8px 12px" }}>Ciudad</th>
                  </tr>
                </thead>
                <tbody>
                  {lists[i]!.map((p) => (
                    <tr key={p.id} style={{ borderTop: "1px solid #f0efec" }}>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                        <Link href={`/admin/crm/personas/${p.id}`}>{[p.firstName, p.lastName].filter(Boolean).join(" ") || "—"}</Link>
                      </td>
                      <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{p.phone ?? "—"}</td>
                      <td style={{ padding: "8px 12px" }}>{p.email}</td>
                      <td style={{ padding: "8px 12px" }}>{p.city ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {s.count > lists[i]!.length && <div style={{ padding: "8px 12px", fontSize: 12, color: "#8a8478" }}>Mostrando {lists[i]!.length} de {s.count}. Usa un segmento con esta etiqueta para verlos todos.</div>}
            </div>
          </section>
        )
      )}
      {summary.every((s) => s.count === 0) && <p style={{ color: "#5b5f6b" }}>Todavía no hay contactos etiquetados.</p>}
    </div>
  );
}
