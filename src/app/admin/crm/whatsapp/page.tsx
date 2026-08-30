import { redirect } from "next/navigation";
import { db } from "@/lib/db";

// /admin/crm/whatsapp itself has nothing to show — send the admin
// straight to Conexión until a connection exists (nothing else in this
// section is useful before that), or to Bandeja once it does (the page
// they'll actually want day to day).
export default async function WhatsAppIndexPage() {
  const connection = await db.whatsAppConnection.findFirst({ orderBy: { createdAt: "desc" } });
  redirect(connection ? "/admin/crm/whatsapp/bandeja" : "/admin/crm/whatsapp/conexion");
}
