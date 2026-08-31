"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface TemplateOption {
  id: string;
  name: string;
  language: string;
}

interface AutomationState {
  templateId: string;
  templateName: string;
  templateLanguage: string;
  enabled: boolean;
}

/** One card per known trigger (AUTOMATION_TRIGGERS in lib/whatsapp/
 * automations.ts) on the Automatizaciones page — not configured yet
 * (pick a template to turn it on), configured and on, or configured and
 * paused. Unlike Difusiones, nobody clicks "enviar" here: the trigger
 * fires it, this card only decides which template and whether it's
 * live. */
export default function AutomationCard({
  trigger,
  label,
  description,
  eligibleTemplates,
  automation,
}: {
  trigger: string;
  label: string;
  description: string;
  eligibleTemplates: TemplateOption[];
  automation: AutomationState | null;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  // Optimistic mirror of automation.enabled — router.refresh() re-fetches
  // the server component asynchronously, so driving the checkbox straight
  // off the `automation` prop would let it visibly snap back to the old
  // value for a beat after every click (and browsers can even reject the
  // click outright on a controlled checkbox whose state didn't move).
  // Re-synced whenever a fresh `automation` prop lands, so a change from
  // elsewhere (another tab, "Cambiar plantilla") still wins.
  const [enabled, setEnabled] = useState(automation?.enabled ?? false);
  useEffect(() => {
    if (automation) setEnabled(automation.enabled);
  }, [automation?.enabled]);

  async function activate(templateId: string) {
    setStatus("saving");
    setMessage(null);
    const res = await fetch(`/api/admin/whatsapp/automations/${trigger}`, {
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

  async function toggle(next: boolean) {
    setEnabled(next); // optimistic — see the state's own comment
    setStatus("saving");
    setMessage(null);
    const res = await fetch(`/api/admin/whatsapp/automations/${trigger}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    setStatus("idle");
    if (res.ok) router.refresh();
    else {
      setEnabled(!next); // revert the optimistic flip
      setMessage("No se pudo actualizar.");
    }
  }

  async function remove() {
    if (!confirm("¿Quitar esta automatización? Vas a tener que elegir la plantilla de nuevo si la reactivas.")) return;
    setStatus("saving");
    const res = await fetch(`/api/admin/whatsapp/automations/${trigger}`, { method: "DELETE" });
    setStatus("idle");
    if (res.ok) router.refresh();
    else setMessage("No se pudo quitar.");
  }

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
              background: enabled ? "#e8f6ef" : "#f6f5f2",
              color: enabled ? "#0e6b4c" : "#5b5f6b",
            }}
          >
            {enabled ? "Activa" : "Pausada"}
          </span>
        )}
      </div>

      {automation ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0efec" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13 }}>
            Plantilla: <strong>{automation.templateName}</strong> ({automation.templateLanguage})
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
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
        </div>
      ) : eligibleTemplates.length === 0 ? (
        <p style={{ marginTop: 12, fontSize: 13, color: "#8a8478" }}>
          Sin configurar — todavía no hay ninguna plantilla APROBADA con un botón de enlace dinámico. Créala en Plantillas
          (marca &quot;el enlace es distinto para cada persona&quot; en el botón) y vuelve cuando Meta la apruebe.
        </p>
      ) : (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
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
