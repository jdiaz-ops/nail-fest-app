import type { Metadata } from "next";
import PortalShell from "@/components/portal/PortalShell";
import ProfileEditor from "@/components/portal/ProfileEditor";
import { SubmitReviewButton } from "@/components/portal/PortalActions";
import { getLibrarySettings } from "@/lib/library/settings";
import { resolveTexts } from "@/lib/library/texts";
import { profileStatus, profileValuesOf } from "@/lib/library/portal";
import { requirePortalPage } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mi perfil · Instructoras Nail Fest", robots: { index: false, follow: false } };

// "Mi perfil": everything that's hers to change (components/portal/
// ProfileEditor). A profile she never sent gets its button to send it.
export default async function MiPerfilPage() {
  const { instructor } = await requirePortalPage();
  const settings = await getLibrarySettings();
  const texts = resolveTexts(settings.texts);
  const status = profileStatus(instructor);
  const teamMarks = [
    ...(instructor.invited ? [texts.sealLabel] : []),
    ...(instructor.featured ? [texts.featuredLabel] : []),
    ...instructor.appearances.map((a) => `Ha estado en: ${a}`),
  ];

  return (
    <PortalShell instructor={instructor} tab="perfil">
      <div className="pt-wrap">
        <h1 className={`pt-h1 ${fraunces.className}`}>Mi perfil</h1>
        <p className="pt-lede">
          {status === "live" || status === "paused"
            ? "Así te ven en el directorio. Los cambios salen al guardar."
            : "Así te verán en el directorio cuando el equipo lo publique."}
        </p>
        {status === "draft" && (
          <div className="pt-card pt-status pt-status--wait">
            <p>Tu perfil todavía no le llega al equipo. Cuando esté listo, envíalo a revisión.</p>
            <SubmitReviewButton />
          </div>
        )}
        <ProfileEditor
          slug={instructor.slug}
          initial={profileValuesOf(instructor)}
          approved={Boolean(instructor.approvedAt) && instructor.visible}
          initialPaused={instructor.paused}
          directoryOpen={settings.instructorsPublished}
          teamMarks={teamMarks}
        />
      </div>
    </PortalShell>
  );
}
