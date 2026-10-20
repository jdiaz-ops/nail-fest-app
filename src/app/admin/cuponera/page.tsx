import { requirePageUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { getCuponeraAdminData } from "@/lib/cuponera/admin";
import { keyHint, marcoliniConfig } from "@/lib/cuponera/marcolini";
import { CUPONERA_DEFAULT_TEXTS, getCuponeraSettings } from "@/lib/cuponera/settings";
import CuponeraSyncCard from "./CuponeraSyncCard";
import CuponeraSettingsForm from "./CuponeraSettingsForm";
import CuponeraBrandsEditor from "./CuponeraBrandsEditor";
import CuponeraCollectionsEditor from "./CuponeraCollectionsEditor";
import CuponeraProductsEditor from "./CuponeraProductsEditor";
import CuponeraPreview from "./CuponeraPreview";

export const dynamic = "force-dynamic";

const syncDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Bogota",
});

// "Editar cuponera" — nailfest.lat/cuponera's editor, a top-level nav item
// next to Editar homepage and Editar Links (ADMIN-only, same as those).
// Brands, codes, prices and photos arrive on their own from Marcolini (see
// lib/cuponera/sync.ts); this screen decides what shows, in what order and
// under which category, and when the page goes public.
export default async function AdminCuponeraPage() {
  await requirePageUser(["ADMIN"]);
  const [settings, data, lastMapping] = await Promise.all([
    getCuponeraSettings(),
    getCuponeraAdminData(),
    db.cuponeraCollectionMap.aggregate({ _max: { updatedAt: true }, _count: { _all: true } }),
  ]);
  // The products editor keeps its own copy while editing; a new sync or a
  // collection mapped in the unifier changes this key and reloads it.
  const productsVersion = `${settings.lastSyncAt?.toISOString() ?? "never"}|${lastMapping._max.updatedAt?.toISOString() ?? ""}|${lastMapping._count._all}`;
  const config = marcoliniConfig();
  // What the public page needs to show the real catalog (getCuponeraView).
  const hasProducts = data.products.some((p) => p.available && p.visible && p.brandVisible);

  return (
    <div className="cup-admin">
      <div className="cup-admin-main">
        <h1 style={{ fontSize: 24, marginBottom: 4 }}>Editar cuponera</h1>
        <p style={{ color: "#5b5f6b", marginTop: 0, marginBottom: 4, maxWidth: 900 }}>
          La cuponera en nailfest.lat/cuponera: los descuentos de las marcas que aceptaron a Nail Fest como creadora en Marcolini. Marcas,
          códigos, precios y fotos llegan solos de Marcolini; aquí decides qué se ve, en qué orden y en qué categoría.
        </p>
        <p style={{ fontSize: 13, marginTop: 0 }}>
          <a href="/cuponera" target="_blank" rel="noreferrer">
            Ver la cuponera ↗
          </a>
        </p>

        <CuponeraSyncCard
          configured={Boolean(config)}
          marcoliniHost={config ? new URL(config.baseUrl).host : null}
          keyHint={config ? keyHint(config.apiKey) : null}
          lastSyncLabel={settings.lastSyncAt ? syncDateFormatter.format(settings.lastSyncAt) : null}
          lastSyncOk={settings.lastSyncOk}
          lastSyncError={settings.lastSyncError}
          lastSyncBrands={settings.lastSyncBrands}
          lastSyncProducts={settings.lastSyncProducts}
          creatorName={settings.creatorName}
          creatorSlug={settings.creatorSlug}
        />

        <CuponeraSettingsForm
          initial={{
            published: settings.published,
            heroTitle: settings.heroTitle,
            heroLede: settings.heroLede,
            showDeal: settings.showDeal,
            showCoupons: settings.showCoupons,
            showNew: settings.showNew,
            showBestsellers: settings.showBestsellers,
            newTitle: settings.newTitle,
            newSubtitle: settings.newSubtitle,
            newDays: settings.newDays,
          }}
          defaults={CUPONERA_DEFAULT_TEXTS}
          hasProducts={hasProducts}
        />

        <CuponeraBrandsEditor brands={data.brands} />

        <CuponeraCollectionsEditor collections={data.collections} />

        <CuponeraProductsEditor key={productsVersion} initialProducts={data.products} brands={data.brands.map((b) => ({ id: b.id, name: b.name }))} />
      </div>

      {/* Only on screens with room for it, next to the editors (globals.css). */}
      <aside className="cup-admin-preview" aria-label="Vista previa de la cuponera">
        <CuponeraPreview />
      </aside>
    </div>
  );
}
