import { requirePageUser } from "@/lib/auth/guard";
import { getMesaAdminData } from "@/lib/mesa/data";
import MesaAdmin from "./MesaAdmin";

export const dynamic = "force-dynamic";

// La Mesa (2026-10-25): the bank of Nail Fest's newsletter — Claude's ideas
// for each section, the approved ones, the next editions and their subject
// lines (./MesaAdmin.tsx). ADMIN-only, like the other editors.
export default async function AdminMesaPage() {
  await requirePageUser(["ADMIN"]);
  return <MesaAdmin data={await getMesaAdminData()} />;
}
