"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface TemplateOption {
  id: string;
  name: string;
  language: string;
  bodyText: string;
  variableCount: number;
}

interface MergeTagOption {
  key: string;
  label: string;
}

interface AutomationState {
  templateId: string;
  templateName: string;
  templateLanguage: string;
  enabled: boolean;
  variableMapping: Record<string, string> | null;
}

/** One DEFAULT/VIRTUAL block's own activate/toggle/remove/mapping logic —
 * used twice by AutomationCard below (the always-present DEFAULT
 * pairing, and the optional VIRTUAL override) so the two don't drift
 * apart. `scope` becomes `?scope=VIRTUAL` on every request; DEFAULT
 * omits it entirely, matching the route's own "no query param =
 * DEFAULT" convention. */
function AutomationScopeBlock({
  trigger,
  scope,
  eligibleTemplates,
  automation,
  mergeTags,
}: {
  trigger: string;
  scope: "DEFAULT" | "VIRTUAL";
  eligibleTemplates: TemplateOption[];
  automation: AutomationState | null;
  mergeTags: MergeTagOption[];
}) {
  const router = useRouter();
  const [picked, setPicked] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Optimistic mirror of automation.enabled — see the original single-
  // scope component's own comment on why (router.refresh() lands async).
  const [enabled, setEnabled] = useState(automation?.enabled ?? false);
  useEffect(() => {
    if (automation) setEnabled(automation.enabled);
  }, [automation?.enabled]);

  const activeTemplate = automation ? eligibleTemplates.find((t) => t.id === automation.templateId) : undefined;
  // Local draft of the {slot: mergeTagKey} mapping — starts from
  // whatever's saved, edited freely, only actually persisted on "Guardar
  // variables" (a separate save from activate/toggle/remove, since
  // re-mapping shouldn't require repicking the template).
  const [mapping, setMapping] = useState<Record<string, string>>(automation?.variableMapping ?? {});
  useEffect(() => {
    setMapping(automation?.variableMapping ?? {});
  }, [automation?.templateId, automation?.variableMapping]);

  const variableSlots = useMemo(
    () => (activeTemplate ? Array.from({ length: activeTemplate.variableCount }, (_, i) => String(i + 1)) : []),
    [activeTemplate]
  );

  const preview = useMemo(() => {
    if (!activeTemplate?.bodyText) return null;
    let text = activeTemplate.bodyText;
    for (const slot of variableSlots) {
      const tag = mergeTags.find((m) => m.key === mapping[slot]);
      text = text.split(`{{${slot}}}`).join(tag ? `[${tag.label}]` : `{{${slot}}}`);
    }
    return text;
  }, [activeTemplate, variableSlots, mapping]);

  const qs = scope === "VIRTUAL" ? "?scope=VIRTUAL" : "";

  async function activate(templateId: string) {
    setStatus("saving");
    setMessage(null);
    const res = await fetch(`/api/admin/whatsapp/automations/${trigger}${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    if (res.ok) {
      setStatus("idle");
      setPicked("");
      setEnabled(true);
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setMessage(body?.message ?? "No se pudo activar.");
    }
  }

  async function saveMapping() {
    if (!automation) return;
    setStatus("saving");
    setMessage(null);
    const res = await fetch(`/api/admin/whatsapp/automations/${trigger}${qs}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: automation.templateId, variableMapping: mapping }),
    });
    setStatus("idle");
    setMessage(res.ok ? "Variables guardadas." : "No se pudieron guardar las variables.");
    if (res.ok) router.refresh();
  }

  async function toggle(next: boolean) {
    setEnabled(next); // optimistic — see the state's own comment
    setStatus("saving");
    setMessage(null);
    const res = await fetch(`/api/admin/whatsapp/automations/${trigger}${qs}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setStatus("idle");
    if (res.ok) router.refresh();
    else {
      setEnabled(!next);
      setMessage("No se pudo actualizar.");
    }
  }

  async function remove() {
    if (!confirm("¿Quitar esta plantilla? Vas a tener que elegirla de nuevo si la reactivas.")) return;
    setStatus("saving");
    const res = await fetch(`/api/admin/whatsapp/automations/${trigger}${qs}`, { method: "DELETE" });
    setStatus("idle");
    if (res.ok) router.refresh();
    else setMessage("No se pudo quitar.");
  }

  return (
    <div>
      {automation ? (
        <div>
          <p style={{ margin: "0 0 10px", fontSize: 13 }}>
            Plantilla: <strong>{automation.templateName}</strong> ({automation.templateLanguage})
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: variableSlots.length > 0 ? 12 : 0 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400, cursor: "pointer" }}>
              <input type="checkbox" checked={enabled} disabled={status === "saving"} onChange={(e) => toggle(e.target.checked)} />
              Activa
            </label>
            {eligibleTemplates.length > 1 && (
              <select
                value=""
                disabled={status === "saving"}
                onChange={(e) => e.target.value && activate(e.target.value)}
                style={{ fontSize: 13 }}
              >
                <option value="">Cambiar plantilla…</option>
                {eligibleTemplates
                  .filter((t) => t.id !== automation.templateId)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.language})
                    </option>
                  ))}
              </select>
            )}
            <button type="button" onClick={remove} disabled={status === "saving"} style={{ background: "none", border: "none", color: "#c2185b", cursor: "pointer", fontSize: 13, padding: 0 }}>
              Quitar
            </button>
          </div>

          {variableSlots.length > 0 && (
            <div style={{ background: "#faf9f7", border: "1px solid #e3e1dc", borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 8px" }}>Variables de la plantilla</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
                {variableSlots.map((slot) => (
                  <div key={slot} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 11, color: "#5b5f6b" }}>{`{{${slot}}}`}</label>
                    <select
                      value={mapping[slot] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [slot]: e.target.value }))}
                      style={{ fontSize: 12 }}
                    >
                      <option value="">Sin usar</option>
                      {mergeTags.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {preview && <p style={{ fontSize: 12, color: "#5b5f6b", fontStyle: "italic", margin: "0 0 10px", whiteSpace: "pre-wrap" }}>“{preview}”</p>}
              <button type="button" className="secondary" disabled={status === "saving"} onClick={saveMapping} style={{ width: "auto", padding: "5px 14px", fontSize: 12 }}>
                Guardar variables
              </button>
            </div>
          )}
        </div>
      ) : eligibleTemplates.length === 0 ? (
        <p style={{ fontSize: 13, color: "#8a8478" }}>
          Sin configurar — todavía no hay ninguna plantilla APROBADA con variables o un botón de enlace dinámico. Créala
          en Plantillas y vuelve cuando Meta la apruebe.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={picked} onChange={(e) => setPicked(e.target.value)} style={{ fontSize: 13, maxWidth: 320 }}>
            <option value="">Elegir plantilla…</option>
            {eligibleTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.language})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="primary"
            disabled={!picked || status === "saving"}
            onClick={() => activate(picked)}
            style={{ width: "auto", padding: "6px 16px", fontSize: 13 }}
          >
            Activar
          </button>
        </div>
      )}
      {message && <p style={{ marginTop: 8, fontSize: 13, color: "#c2185b" }}>{message}</p>}
    </div>
  );
}

/** One card per known trigger (AUTOMATION_TRIGGERS in lib/whatsapp/
 * automations.ts) on the Automatizaciones page — not configured yet
 * (pick a template to turn it on), configured and on, or configured and
 * paused. Unlike Difusiones, nobody clicks "enviar" here: the trigger
 * fires it, this card only decides which template, how its variables map
 * (see WhatsAppAutomation.variableMapping's own schema comment), and
 * whether it's live.
 *
 * `virtualOverride` is the optional second pairing — a WhatsApp
 * template's body is fixed/pre-approved by Meta, so "adapt this
 * notification for a virtual event" means picking a DIFFERENT approved
 * template for that case, not rendering one conditionally (see
 * AutomationFormatScope's own schema comment). Only shown when
 * `supportsVirtualOverride` is true — a trigger that ONLY ever fires for
 * virtual events (see AUTOMATION_TRIGGERS' own comment) has no
 * "presencial" case to override away from. Leave it unconfigured and
 * every event, virtual or not, just uses the DEFAULT pairing above it —
 * nothing changes from before this existed. */
export default function AutomationCard({
  trigger,
  label,
  description,
  eligibleTemplates,
  automation,
  virtualOverride,
  supportsVirtualOverride,
  mergeTags,
}: {
  trigger: string;
  label: string;
  description: string;
  eligibleTemplates: TemplateOption[];
  automation: AutomationState | null;
  virtualOverride: AutomationState | null;
  supportsVirtualOverride: boolean;
  mergeTags: MergeTagOption[];
}) {
  const [showVirtual, setShowVirtual] = useState(virtualOverride != null);

  return (
    <div style={{ border: "1px solid #e3e1dc", borderRadius: 10, padding: 16, marginBottom: 16, maxWidth: 760 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600 }}>{label}</p>
          <p style={{ margin: 0, fontSize: 13, color: "#5b5f6b", maxWidth: 560 }}>{description}</p>
        </div>
        {automation && (
          <span
            style={{
              flexShrink: 0,
              display: "inline-flex",
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              background: automation.enabled ? "#e8f6ef" : "#f6f5f2",
              color: automation.enabled ? "#0e6b4c" : "#5b5f6b",
            }}
          >
            {automation.enabled ? "Activa" : "Pausada"}
          </span>
        )}
      </div>

      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0efec" }}>
        <AutomationScopeBlock trigger={trigger} scope="DEFAULT" eligibleTemplates={eligibleTemplates} automation={automation} mergeTags={mergeTags} />
      </div>

      {supportsVirtualOverride && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #f0efec" }}>
          {showVirtual ? (
            <>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#5b5f6b" }}>
                Para eventos VIRTUALES (opcional) — necesita su propia plantilla aprobada por Meta con el texto correcto
                (sin &quot;preséntala en la entrada&quot;, por ejemplo). Sin esto, un evento virtual usa la plantilla de
                arriba tal cual.
              </p>
              <AutomationScopeBlock trigger={trigger} scope="VIRTUAL" eligibleTemplates={eligibleTemplates} automation={virtualOverride} mergeTags={mergeTags} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowVirtual(true)}
              style={{ background: "none", border: "none", color: "var(--link)", cursor: "pointer", fontSize: 13, padding: 0 }}
            >
              + Usar una plantilla distinta para eventos virtuales
            </button>
          )}
        </div>
      )}
    </div>
  );
}
