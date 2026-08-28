import { redirect } from "next/navigation";

// Moved under the "CRM" top-level tab — keeps old bookmarks working.
export default function RegistrationsRedirectPage() {
  redirect("/admin/crm/registrations");
}
