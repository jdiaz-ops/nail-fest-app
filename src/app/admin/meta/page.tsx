import { redirect } from "next/navigation";

// Moved under Configuración → Manage → Integraciones, matching our
// previous ticketing platform's Box office settings structure — this
// redirect just keeps any old bookmark/link to /admin/meta working.
export default function MetaRedirectPage() {
  redirect("/admin/settings/integrations");
}
