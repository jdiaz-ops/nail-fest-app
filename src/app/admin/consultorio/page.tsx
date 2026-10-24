import { requirePageUser } from "@/lib/auth/guard";
import { getLibrarySettings } from "@/lib/library/settings";
import { getConsultorioAdminData } from "@/lib/community/data";
import ConsultorioAdmin from "./ConsultorioAdmin";

export const dynamic = "force-dynamic";

// "Consultorio" in the admin: its switch, what was posted lately (to hide or
// show), the members (to block, or to send a new-password link by hand) —
// and the way to answer as "Equipo Nail Fest" (the Consultorio itself,
// logged in here).
export default async function AdminConsultorioPage() {
  const user = await requirePageUser(["ADMIN", "COORDINADOR"]);
  const [settings, data] = await Promise.all([getLibrarySettings(), getConsultorioAdminData()]);
  return <ConsultorioAdmin published={settings.consultorioPublished} canPublish={user.role === "ADMIN"} data={data} />;
}
