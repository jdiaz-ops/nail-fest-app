import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";

// /admin/crm/whatsapp itself has nothing to show — send the admin
// straight to Conexión until a connection exists (nothing else in this
// section is useful before that), or to Bandeja once it does (the page
// they'll actually want day to day). COORDINADOR never sees Conexión at
// all (ADMIN-only, see that page's own comment) — always Bandeja for
// them, connected or not, rather than bouncing into a page they'd
// immediately get redirected back out of.
export default async function WhatsAppIndexPage() {
  const user = await getCurrentUser();
  if (user?.role === "COORDINADOR") {
    redirect("/admin/crm/whatsapp/bandeja");
  }
  const connection = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" } });
  redirect(connection ? "/admin/crm/whatsapp/bandeja" : "/admin/crm/whatsapp/conexion");
}
