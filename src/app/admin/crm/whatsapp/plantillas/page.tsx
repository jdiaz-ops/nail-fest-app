import { db } from "@/lib/db";
import type { WhatsAppTemplateButton } from "@/lib/whatsapp/provider";
import { requirePageUser } from "@/lib/auth/guard";
import WhatsAppTemplateSyncButton from "@/components/WhatsAppTemplateSyncButton";
import WhatsAppTemplateCreateForm from "@/components/WhatsAppTemplateCreateForm";
import AttendancePollToggle from "@/components/AttendancePollToggle";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, { bg: string; ink: string }> = {
  APPROVED: { bg: "#e8f6ef", ink: "#0e6b4c" },
  PENDING: { bg: "#fdf1e6", ink: "#8a5a1f" },
  REJECTED: { bg: "#fdeaea", ink: "#a3251f" },
  PAUSED: { bg: "#f6f5f2", ink: "#5b5f6b" },
  DISABLED: { bg: "#f6f5f2", ink: "#5b5f6b" },
};

function buttonLabel(b: WhatsAppTemplateButton): string {
  if (b.type === "URL") return `🔗 ${b.text}`;
  if (b.type === "PHONE_NUMBER") return `📞 ${b.text}`;
  return `↩ ${b.text}`;
}

// ADMIN-only — see WhatsAppConexionPage's own comment.
export default async function WhatsAppTemplatesPage() {
  await requirePageUser(["ADMIN"]);
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

      <p style={{ fontSize: 13, color: "#5b5f6b", maxWidth: 720, marginTop: 16 }}>
        ¿Tienes una plantilla de UTILIDAD con 2 botones de respuesta rápida tipo &quot;Sí voy&quot; /
        &quot;No puedo&quot;, para preguntar antes del evento si la gente sigue viniendo? Márcala como
        &quot;Encuesta de asistencia&quot; abajo — a partir de ahí, cada respuesta que llegue por ese
        canal queda registrada y se ve en el reporte de cada evento (pestaña Reportes).
      </p>

      <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginTop: 24 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 14, width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#faf9f7" }}>
              <th style={{ padding: "10px 12px" }}>Nombre</th>
              <th style={{ padding: "10px 12px" }}>Idioma</th>
              <th style={{ padding: "10px 12px" }}>Categoría</th>
              <th style={{ padding: "10px 12px" }}>Estado</th>
              <th style={{ padding: "10px 12px" }}>Variables</th>
              <th style={{ padding: "10px 12px" }}>Contenido</th>
              <th style={{ padding: "10px 12px" }}>Encuesta de asistencia</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => {
              const style = STATUS_STYLE[t.status] ?? { bg: "#f6f5f2", ink: "#5b5f6b" };
              const buttons = (t.buttons as unknown as WhatsAppTemplateButton[] | null) ?? [];
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
                  <td style={{ padding: "10px 12px", color: "#5b5f6b", maxWidth: 360 }}>
                    {t.headerType === "TEXT" && t.headerText && <div style={{ fontWeight: 600, color: "#1c1310" }}>{t.headerText}</div>}
                    <div>{t.bodyText ?? "—"}</div>
                    {t.footerText && <div style={{ fontSize: 12, color: "#8a8478" }}>{t.footerText}</div>}
                    {buttons.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                        {buttons.map((b, i) => (
                          <span key={i} style={{ fontSize: 12, background: "#f0efec", borderRadius: 999, padding: "2px 8px" }}>
                            {buttonLabel(b)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {buttons.filter((b) => b.type === "QUICK_REPLY").length >= 2 ? (
                      <AttendancePollToggle templateId={t.id} initialValue={t.isAttendancePoll} />
                    ) : (
                      <span style={{ fontSize: 12, color: "#b5b0a6" }} title="Necesita al menos 2 botones de respuesta rápida (ej. Sí voy / No puedo)">
                        —
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {templates.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "10px 12px", color: "#5b5f6b" }}>
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
