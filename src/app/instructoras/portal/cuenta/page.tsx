import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import AccountForm from "@/components/portal/AccountForm";
import { profileAddress, requirePortalPage } from "@/lib/library/portalAuth";
import { getLibrarySettings, videosPublished } from "@/lib/library/settings";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Cuenta · Instructoras Nail Fest", robots: { index: false, follow: false } };

// "Cuenta": her username — fixed, it's her profile's address — and
// components/portal/AccountForm for the rest.
export default async function CuentaPage() {
  const [{ instructor, account }, settings] = await Promise.all([requirePortalPage(), getLibrarySettings()]);
  const address = profileAddress(instructor.slug);

  return (
    <PortalShell instructor={instructor} tab="cuenta" videos={videosPublished(settings)}>
      <div className="pt-wrap">
        <h1 className={`pt-h1 ${fraunces.className}`}>Cuenta</h1>
        <div className="pt-card">
          <h2 className="pt-h3">Usuario</h2>
          <span className="pt-url">{instructor.slug}</span>
          <span className="pt-hint">
            Es la dirección de tu perfil: <b>{address.label}</b>. No se puede cambiar; si lo necesitas, pídeselo al equipo.
          </span>
        </div>
        <AccountForm email={account.email} phone={account.phone} />
        <p className="pt-center">Para borrar tu perfil, pídeselo al equipo de Nail Fest.</p>
      </div>
    </PortalShell>
  );
}
