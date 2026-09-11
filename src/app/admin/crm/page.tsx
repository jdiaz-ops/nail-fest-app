import { redirect } from "next/navigation";

// "Inscritos" (the old default landing here) was removed — see
// crm/layout.tsx's own comment. Personas is the first real item in that
// nav now, so it's the new default.
export default function CrmIndexPage() {
  redirect("/admin/crm/personas");
}
