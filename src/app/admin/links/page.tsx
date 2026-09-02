import { requirePageUser } from "@/lib/auth/guard";
import { getOrderedLinks } from "@/lib/linkPage";
import LinksEditor from "./LinksEditor";

export const dynamic = "force-dynamic";

// nailfest.co/links — a Linktree-equivalent, top-level nav item (same
// placement reasoning as /admin/homepage: ADMIN-only, not nested under
// Configuración). Title+URL is the only required content — see
// LinkPageLink's own schema comment for the richer embedded-form/
// schedule/speaker-list idea this deliberately defers. Each link can
// optionally carry its own background (photo/GIF/video, same upload
// widget as the homepage editor) — when set, the public page renders
// that link as the homepage's own "event box" card pattern instead of a
// plain pill.
export default async function AdminLinksPage() {
  await requirePageUser(["ADMIN"]);
  const links = await getOrderedLinks();

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Editar Links</h1>
      <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 24 }}>
        La página pública en nailfest.co/links — como un Linktree propio, con el mismo logo y
        eslogan de la homepage arriba. Cada bloque es un título y un enlace; el orden aquí es el
        mismo orden en que se ven ahí. Opcionalmente puedes subirle a un link su propia imagen,
        GIF o video de fondo — se ve como una tarjeta, igual que la caja del evento en la
        homepage. Un link desactivado se queda en la lista pero no aparece en la página pública.
      </p>
      <LinksEditor
        initialLinks={links.map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          enabled: l.enabled,
          imageUrl: l.imageUrl,
          videoUrl: l.videoUrl,
        }))}
      />
    </div>
  );
}
