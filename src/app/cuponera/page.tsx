import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getCuponeraView, type CuponeraNewItem, type CuponeraView } from "@/lib/cuponera/data";
import { CUPONERA_DEFAULT_TEXTS, getCuponeraSettings } from "@/lib/cuponera/settings";
import { discountPercent, formatCop } from "@/lib/cuponera/shared";
import { SAMPLE_COUPONS, SAMPLE_DESIGN, SAMPLE_LISTS, SAMPLE_NEW, SAMPLE_PRODUCTS } from "@/lib/cuponera/sampleData";
import CuponeraOfertas from "@/components/cuponera/CuponeraOfertas";
import CouponCard from "@/components/cuponera/CouponCard";
import ShopTheDesign from "@/components/cuponera/ShopTheDesign";
import PreviewLink from "@/components/cuponera/PreviewLink";
import PreviewToast from "@/components/cuponera/PreviewToast";
import ProductPhoto from "@/components/cuponera/ProductPhoto";
import ProductTiles from "@/components/cuponera/ProductTiles";
import WeekSignup from "@/components/cuponera/WeekSignup";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCuponeraSettings();
  return {
    title: "Cuponera · Nail Fest",
    description: "Los descuentos de las marcas de Nail Fest, todo el año.",
    // Indexed only once it's public; the preview never is.
    robots: settings.published ? undefined : { index: false, follow: false },
  };
}

function NewCard({ item: { product, moreInLine } }: { item: CuponeraNewItem }) {
  return (
    <PreviewLink
      href={product.url}
      preview={`Vista previa: aquí se abriría ${product.name} en la tienda de ${product.brand}, con el código ${product.code}.`}
      className="cup-newcard"
    >
      <span className="cup-newcard-photo" style={{ background: product.tint }}>
        <span className="cup-new">Nuevo</span>
        <ProductPhoto product={product} size={60} />
      </span>
      <span className="cup-newcard-body">
        <span className="cup-brandname">{product.brand}</span>
        <span className="cup-newcard-name">{product.name}</span>
        {moreInLine > 0 && (
          <span className="cup-newcard-more">{moreInLine === 1 ? "y 1 novedad más de la línea" : `y ${moreInLine} novedades más de la línea`}</span>
        )}
        <span className="cup-prices">
          <span className="cup-price">
            {product.priceFrom && <span className="cup-from">Desde </span>}
            {formatCop(product.price)}
          </span>
          {discountPercent(product.price, product.before) > 0 && <span className="cup-before">{formatCop(product.before)}</span>}
        </span>
        <span className="cup-newcard-cta">Ver en la tienda →</span>
      </span>
    </PreviewLink>
  );
}

// nailfest.lat/cuponera — the year-round coupon book. With Marcolini's
// catalog in (lib/cuponera/data.ts) it shows the real brands and products
// as curated in /admin/cuponera; visitors only see it once it's published
// there, staff always does (with a banner while it's hidden). Before the
// first sync it's the sample mockup — staff-only, never public.
//
// People come to explore deals: the only way out is to a store. No links
// to the rest of nailfest.lat (events, reviews), and no "Robo del día" —
// hidden on 2026-10-20 ("la única salida es clic a una tienda para
// comprar"); DealOfTheDay and its admin form stay in the code, unused.
export default async function CuponeraPage({ searchParams }: { searchParams: { vista?: string } }) {
  const [staff, view] = await Promise.all([viewerCanSeeSamples(), getCuponeraView()]);
  if (view ? !view.settings.published && !staff : !staff) notFound();

  // Inside Editar cuponera's preview the banner is noise: that screen
  // already says whether the page is public.
  const embedded = staff && searchParams.vista === "admin";
  const hiddenNote = embedded
    ? null
    : !view
    ? "Datos de ejemplo: las marcas y los precios no son reales y los links todavía no abren tiendas."
    : !view.settings.published
      ? "La cuponera todavía no es pública: el resto de las personas ven «página no encontrada»."
      : null;

  return (
    <main className="cup-page">
      {hiddenNote && (
        <div className="cup-preview">
          <span>
            <b>Vista previa del equipo.</b> {hiddenNote}
          </span>
          <Link href="/admin/cuponera">Ir a Editar cuponera</Link>
        </div>
      )}

      <header className="cup-header">
        <div className="cup-header-inner">
          <div className="cup-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>Cuponera</span>
          </div>
        </div>
      </header>

      <div className="cup-wrap">{view ? <RealSections view={view} /> : <SampleSections />}</div>

      <PreviewToast />
    </main>
  );
}

function RealSections({ view }: { view: CuponeraView }) {
  return (
    <>
      <CuponeraOfertas products={view.products} title={view.texts.heroTitle} lede={view.texts.heroLede} displayClassName={fraunces.className} />

      {view.bestsellers.length > 0 && (
        <section className="cup-section">
          <div className="cup-section-head">
            <h2 className={`cup-h2 ${fraunces.className}`}>Lo más comprado por la comunidad Nail Fest</h2>
            <p className="cup-sub">Lo que más se ha comprado con los códigos de Nail Fest en los últimos 90 días.</p>
          </div>
          <ProductTiles tiles={view.bestsellers} ranked displayClassName={fraunces.className} />
        </section>
      )}

      {view.coupons.length > 0 && (
        <section className="cup-section">
          <div className="cup-section-head">
            <h2 className={`cup-h2 ${fraunces.className}`}>Cupones de las marcas</h2>
            <p className="cup-sub">Copia el código y úsalo en la tienda de cada marca.</p>
          </div>
          <div className="cup-coupons cup-coupons--grid">
            {view.coupons.map((c) => (
              <CouponCard key={c.id} coupon={c} displayClassName={fraunces.className} />
            ))}
          </div>
        </section>
      )}

      {view.news.length > 0 && (
        <section className="cup-section">
          <div className="cup-section-head">
            <h2 className={`cup-h2 ${fraunces.className}`}>{view.texts.newTitle}</h2>
            <p className="cup-sub">{view.texts.newSubtitle}</p>
          </div>
          <div className="cup-news">
            {view.news.map((item) => (
              <NewCard key={item.product.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}

function SampleSections() {
  return (
    <>
      <CuponeraOfertas
        products={SAMPLE_PRODUCTS}
        title={CUPONERA_DEFAULT_TEXTS.heroTitle}
        lede={CUPONERA_DEFAULT_TEXTS.heroLede}
        displayClassName={fraunces.className}
      />

      <div className="cup-duo">
        <div className="cup-duo-main">
          <ShopTheDesign design={SAMPLE_DESIGN} displayClassName={fraunces.className} />
        </div>
        <section className="cup-duo-side cup-section">
          <div className="cup-section-head">
            <h2 className={`cup-h2 ${fraunces.className}`}>Cupones de las marcas</h2>
            <p className="cup-sub">Copia el código y úsalo en la tienda de cada marca.</p>
          </div>
          <div className="cup-coupons">
            {SAMPLE_COUPONS.map((c) => (
              <CouponCard key={c.id} coupon={c} displayClassName={fraunces.className} sample />
            ))}
          </div>
        </section>
      </div>

      <section className="cup-section">
        <h2 className={`cup-h2 ${fraunces.className}`}>Listas de las educadoras</h2>
        <div className="cup-lists">
          {SAMPLE_LISTS.map((l) => (
            <PreviewLink key={l.id} href={null} preview={`Vista previa: aquí se abriría la lista «${l.title}».`} className="cup-list">
              <span className="cup-list-cover" aria-hidden="true">
                {l.swatches.map((s, i) => (
                  <span key={i} style={{ background: s }} />
                ))}
              </span>
              <span className="cup-list-title">{l.title}</span>
              <span className="cup-list-meta">
                Por {l.author} · {l.count} productos
              </span>
            </PreviewLink>
          ))}
        </div>
      </section>

      <section className="cup-section">
        <div className="cup-section-head">
          <h2 className={`cup-h2 ${fraunces.className}`}>Lo nuevo de la feria</h2>
          <p className="cup-sub">Lanzamientos presentados en Nail Fest Cúcuta.</p>
        </div>
        <div className="cup-news">
          {SAMPLE_NEW.map((p) => (
            <NewCard key={p.id} item={{ product: p, moreInLine: 0 }} />
          ))}
        </div>
      </section>

      <section className="cup-week" aria-labelledby="cup-week-title">
        <div className="cup-week-text">
          <span className="cup-week-eyebrow">Próximamente · [fechas]</span>
          <h2 id="cup-week-title" className={`cup-week-title ${fraunces.className}`}>
            Nail Fest Week
          </h2>
          <p className="cup-week-lede">Una semana con los descuentos más grandes del año en todas las marcas. Si te inscribes, entras 24 horas antes.</p>
        </div>
        <WeekSignup />
      </section>

      <Footer />
    </>
  );
}

function Footer() {
  return (
    <footer className="cup-footer">
      <p>Cada compra se hace en la tienda de la marca, con sus precios y condiciones. Nail Fest recibe una comisión por las compras hechas desde la cuponera.</p>
      <div className="cup-footer-side">
        <span className="cup-footer-tech">Tiendas con tecnología Marcolini</span>
      </div>
    </footer>
  );
}
