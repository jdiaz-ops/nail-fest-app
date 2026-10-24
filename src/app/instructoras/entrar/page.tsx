import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import LoginForm from "@/components/portal/LoginForm";
import { getLibraryViewer } from "@/lib/library/data";
import { getPortalUser } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Entrar · Instructoras Nail Fest", robots: { index: false, follow: false } };

// nailfest.lat/instructoras/entrar — the portal's login. Always open: the
// instructors the team invited have accounts even while the registration
// is closed.
export default async function EntrarPage() {
  const [viewer, user] = await Promise.all([getLibraryViewer(), getPortalUser()]);
  if (user) redirect("/instructoras/portal");
  const canJoin = viewer.config.portalOpen || viewer.staff;

  return (
    <PortalShell
      aside={
        canJoin ? (
          <Link href="/instructoras/unirme" className="pt-link">
            Crear perfil
          </Link>
        ) : null
      }
    >
      <div className="pt-wrap">
        <h1 className={`pt-h1 ${fraunces.className}`}>Entra a tu portal</h1>
        <p className="pt-lede">Para cambiar tu perfil y enviar tus videos.</p>
        <LoginForm />
        {canJoin && (
          <p className="pt-center">
            ¿No tienes cuenta? <Link href="/instructoras/unirme">Crea tu perfil gratis</Link>
          </p>
        )}
      </div>
    </PortalShell>
  );
}
