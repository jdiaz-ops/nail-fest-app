import { requirePageUser } from "@/lib/auth/guard";
import SuppressEmailsForm from "@/components/admin/SuppressEmailsForm";
import CrmPageHeader from "../CrmPageHeader";

export const dynamic = "force-dynamic";

// ADMIN-only, same gating pattern as Importar/Broadcasts/Segmentos (see
// CrmLayout's own comment) — importing a suppression list is a
// deliverability decision for the whole account, not a per-contact
// action.
export default async function SupresionesPage() {
  await requirePageUser(["ADMIN"]);

  return (
    <div>
      <CrmPageHeader
        title="Supresiones"
        subtitle='Pega una lista de correos que ya sabes que NO deben recibir marketing — por ejemplo, el export de Brevo (u otro proveedor) de rebotes duros/suaves y desuscripciones de antes de pasarte a este sistema. Se revoca el consentimiento de marketing de quien coincida por correo; a partir de ahí, cualquier Difusión futura los salta sola (nunca crea contactos nuevos — solo actúa sobre quien ya está en la base).'
      />
      <SuppressEmailsForm />
    </div>
  );
}
