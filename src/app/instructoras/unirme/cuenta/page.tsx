import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import SignupForm from "@/components/portal/SignupForm";
import { getLibraryViewer } from "@/lib/library/data";
import { getPortalUser } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Crea tu cuenta · Instructoras Nail Fest", robots: { index: false, follow: false } };

// "Crea tu cuenta": the sign-up form (components/portal/SignupForm), only
// while the registration is open — or for the team, to try it.
export default async function CrearCuentaPage() {
  const [viewer, user] = await Promise.all([getLibraryViewer(), getPortalUser()]);
  if (user) redirect("/instructoras/portal");
  if (!viewer.config.portalOpen && !viewer.staff) redirect("/instructoras/unirme");

  return (
    <PortalShell
      aside={
        <Link href="/instructoras/entrar" className="pt-link">
          Entrar
        </Link>
      }
      note={viewer.config.portalOpen ? null : "El registro de instructoras está cerrado: solo el equipo puede crear cuentas aquí."}
    >
      <div className="pt-wrap">
        <Link href="/instructoras/unirme" className="bib-back bib-back--dark">
          ← Volver
        </Link>
        <h1 className={`pt-h1 ${fraunces.className}`}>Crea tu cuenta</h1>
        <p className="pt-lede">Gratis. Con ella armas tu perfil y lo cambias cuando quieras.</p>
        <SignupForm />
        <p className="pt-center">
          ¿Ya tienes cuenta? <Link href="/instructoras/entrar">Entrar</Link>
        </p>
      </div>
    </PortalShell>
  );
}
