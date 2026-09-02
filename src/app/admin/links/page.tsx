import { requirePageUser } from "@/lib/auth/guard";
import { getOrderedLinks } from "@/lib/linkPage";
import { getOrgSettings } from "@/lib/settings";
import LinksPageBackgroundForm from "./LinksPageBackgroundForm";
import LinksEditor from "./LinksEditor";

export const dynamic = "force-dynamic";

// nailfest.co/links — a Linktree-equivalent, top-level nav item (same
// placement reasoning as /admin/homepage: ADMIN-only, not nested under
// Configuración). Title+URL is the only required content per link — see
// LinkPageLink's own schema comment for the richer embedded-form/
// schedule/speaker-list idea this deliberately defers. The background
// (photo/GIF/video, same widget as the homepage editor) belongs to the
// PAGE as a whole — OrgSettings.linksPageImageUrl, edited by
// LinksPageBackgroundForm below — not to individual links.
export default async function AdminLinksPage() {
  await requirePageUser(["ADMIN"]);
  const [links, orgSettings] = await Promise.all([getOrderedLinks(), getOrgSettings()]);

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Editar Links</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 24 }}>
        La página pública en nailfest.co/links — como un Linktree propio, con el mismo logo y
        eslogan de la homepage arriba. Cada bloque es un título y un enlace; el orden aquí es el
        mismo orden en que se ven ahí. Un link desactivado se queda en la lista pero no aparece en
        la página pública.
      </p>

      <LinksPageBackgroundForm
        initialImageUrl={orgSettings.linksPageImageUrl}
        initialVideoUrl={orgSettings.linksPageVideoUrl}
      />

      <LinksEditor
        initialLinks={links.map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          enabled: l.enabled,
          clickCount: l.clickCount,
          textAlign: l.textAlign,
        }))}
      />
    </div>
  );
}
