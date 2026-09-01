import { AUTOMATION_TRIGGERS, AUTOMATION_TRIGGER_LIST, listAutomations, listEligibleAutomationTemplates } from "@/lib/whatsapp/automations";
import { requirePageUser } from "@/lib/auth/guard";
import AutomationCard from "@/components/AutomationCard";
import CrmPageHeader from "../../CrmPageHeader";

export const dynamic = "force-dynamic";

// One card per known trigger — not just the configured ones — so an
// admin sees what CAN be automated even before setting anything up. See
// AUTOMATION_TRIGGERS's own comment for how a new trigger gets added.
// ADMIN-only — see WhatsAppConexionPage's own comment.
export default async function WhatsAppAutomationsPage() {
  await requirePageUser(["ADMIN"]);
  const [automations, eligibleTemplates] = await Promise.all([listAutomations(), listEligibleAutomationTemplates()]);
  const byTrigger = new Map(automations.map((a) => [a.trigger, a]));

  return (
    <div>
      <CrmPageHeader
        title="Automatizaciones"
        subtitle="Un disparador (algo que pasa en la app) conectado a una plantilla — se manda solo, uno por uno, no algo que envías a mano como Difusiones. Cada una se puede pausar sin perder la plantilla elegida."
      />

      {AUTOMATION_TRIGGER_LIST.map((trigger) => {
        const meta = AUTOMATION_TRIGGERS[trigger];
        const row = byTrigger.get(trigger);
        return (
          <AutomationCard
            key={trigger}
            trigger={trigger}
            label={meta.label}
            description={meta.description}
            eligibleTemplates={eligibleTemplates}
            automation={
              row
                ? { templateId: row.templateId, templateName: row.template.name, templateLanguage: row.template.language, enabled: row.enabled }
                : null
            }
          />
        );
      })}
    </div>
  );
}
