import { redirect } from "next/navigation";

// La Mesa moved into CRM → Broadcasts (2026-10-25), next to the rest of
// the emails: the old address still takes you there.
export default function AdminMesaPage() {
  redirect("/admin/crm/broadcasts/la-mesa");
}
