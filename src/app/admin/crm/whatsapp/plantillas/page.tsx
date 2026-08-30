import { db } from "@/lib/db";
import WhatsAppTemplateSyncButton from "@/components/WhatsAppTemplateSyncButton";
import WhatsAppTemplateCreateForm from "@/components/WhatsAppTemplateCreateForm";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { bg: string; ink: string }> = {
  APPROVED: { bg: "#e8f6ef", ink: "#0e6b4c" },
  PENDING: { bg: "#fdf1e6", ink: "#8a5a1f" },
  REJECTED: { bg: "#fdeaea", ink: "#a3251f" },
  PAUSED: { bg: "#f6f5f2", ink: "#5b5f6b" },
  DISABLED: { bg: "#f6f5f2", ink: "#5b5f6b" },
};

export default async function WhatsAppTemplatesPage() {
  const templates = await db.whatsAppTemplate.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <CrmPageHeader
        title="Plantillas"
        subtitle="Créalas acá y se envían directo a Meta para revisión — o créalas en el WhatsApp Manager y sincronízalas. El estado (pendiente/aprobada/rechazada) se actualiza al sincronizar."
      />

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <WhatsAppTemplateCreateForm />
        <WhatsAppTemplateSyncButton />
      </div>

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginTop: 24 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Idioma</th>
              <th style={{ padding: "10px 12px" }}>Categoría</th>
              <th style={{ padding: "10px 12px" }}>Estado</th>
              <th style={{ padding: "10px 12px" }}>Variables</th>
              <th style={{ padding: "10px 12px" }}>Cuerpo</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const style = STATUS_STYLE[t.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b" };
              return (
                <tr key={t.id} style={{ borderTop: "1px solid #f0efec" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>{t.name}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{t.language}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{t.category}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ display: "inline-flex", padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: style.bg, color: style.ink }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b" }}>{t.variableCount}</td>
                  <td style={{ padding: "10px 12px", color: "#5b5f6b", maxWidth: 360 }}>{t.bodyText ?? "—"}</td>
                </tr>
              );
            })}
            {templates.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
                  Aún no hay ninguna plantilla — créala arriba, o créala en el WhatsApp Manager de Meta y dale a
                  &quot;Sincronizar con Meta&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
