import { redirect } from "next/navigation";

// nailfest.lat/instructoras/solicitud was the application form; since
// 2026-10-24 each instructor makes her own profile in the portal, so the
// old link goes to its sign-up. What came in before stays in Editar
// biblioteca → Registros.
export default function SolicitudPage() {
  redirect("/instructoras/unirme");
}
