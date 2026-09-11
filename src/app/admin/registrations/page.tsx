import { redirect } from "next/navigation";

// Old bookmark redirect. Its original target (/admin/crm/registrations,
// "Inscritos") was removed — see crm/layout.tsx's own comment — so this
// now lands on Personas instead of a dead link.
export default function RegistrationsRedirectPage() {
  redirect("/admin/crm/personas");
}
