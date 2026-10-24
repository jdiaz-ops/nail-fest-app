import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import Onboarding from "@/components/portal/Onboarding";
import { profileStatus, profileValuesOf } from "@/lib/library/portal";
import { requirePortalPage } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu perfil en 5 pasos · Instructoras Nail Fest", robots: { index: false, follow: false } };

// Right after the sign-up: her profile in five steps
// (components/portal/Onboarding), then off to the team. Once it's sent,
// "Mi perfil" is where she changes it.
export default async function BienvenidaPage() {
  const { instructor } = await requirePortalPage();
  if (profileStatus(instructor) !== "draft") redirect("/instructoras/portal");

  return (
    <PortalShell instructor={instructor}>
      <Onboarding slug={instructor.slug} initial={profileValuesOf(instructor)} titleClass={fraunces.className} />
    </PortalShell>
  );
}
