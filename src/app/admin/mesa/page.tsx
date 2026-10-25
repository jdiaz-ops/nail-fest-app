import { requirePageUser } from "@/lib/auth/guard";
import { getMesaAdminData } from "@/lib/mesa/data";
import { getOrgSettings } from "@/lib/settings";
import MesaAdmin from "./MesaAdmin";

export const dynamic = "force-dynamic";

// La Mesa (2026-10-25): the bank of Nail Fest's newsletter — Claude's ideas
// for each section, the approved ones, the next editions and their subject
// lines — and each edition's template, to look at and to test
// (./MesaAdmin.tsx). ADMIN-only, like the other editors.
export default async function AdminMesaPage() {
  await requirePageUser(["ADMIN"]);
  const [data, org] = await Promise.all([getMesaAdminData(), getOrgSettings()]);
  return <MesaAdmin data={data} testEmail={org.replyToEmail ?? ""} />;
}
