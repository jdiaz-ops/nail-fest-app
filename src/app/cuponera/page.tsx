import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import {
  SAMPLE_COUPONS,
  SAMPLE_DEAL,
  SAMPLE_DESIGN,
  SAMPLE_LISTS,
  SAMPLE_NEW,
  SAMPLE_PRODUCTS,
  discountPercent,
  formatCop,
} from "@/lib/cuponera/sampleData";
import CuponeraOfertas from "@/components/cuponera/CuponeraOfertas";
import DealOfTheDay from "@/components/cuponera/DealOfTheDay";
import CouponCard from "@/components/cuponera/CouponCard";
import ShopTheDesign from "@/components/cuponera/ShopTheDesign";
import PreviewLink from "@/components/cuponera/PreviewLink";
import PreviewToast from "@/components/cuponera/PreviewToast";
import ProductIcon from "@/components/cuponera/ProductIcon";
import WeekSignup from "@/components/cuponera/WeekSignup";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["800", "900"] });

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Cuponera · Nail Fest",
  description: "Los descuentos de las marcas de Nail Fest, todo el año.",
  robots: { index: false, follow: false },
};

// Colombia has no DST: Bogotá is always UTC−5.
function nextBogotaMidnight(now: Date): Date {
  const offsetMs = 5 * 3600 * 1000;
  const dayMs = 24 * 3600 * 1000;
  const bogotaNow = now.getTime() - offsetMs;
  return new Date(Math.floor(bogotaNow / dayMs) * dayMs + dayMs + offsetMs);
}

// nailfest.lat/cuponera — the year-round coupon book. For now a staff-only
// preview of the mockup with sample data (the same gate as the review
// samples): anyone else gets a 404 until real brands and products feed it.
export default async function CuponeraPage() {
  if (!(await viewerCanSeeSamples())) notFound();

  const now = new Date();
  const endsAt = nextBogotaMidnight(now);
  const initialSeconds = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));

  return (
    <main className="cup-page">
      <div className="cup-preview">
        <span>
          <b>Vista previa del equipo.</b> Datos de ejemplo: las marcas y los precios no son reales y los links todavía no abren tiendas.
        </span>
        <Link href="/admin">Volver al admin</Link>
      </div>

      <header className="cup-header">
        <div className="cup-header-inner">
          <Link href="/" className="cup-brand">
            {/* eslint-disable-next-line @next/next/no-img-element -- fixed logo mark */}
            <img src="/logo.png" alt="Nail Fest" />
            <span>Cuponera</span>
          </Link>
          <Link href="/" className="cup-header-link">
            Ver eventos
          </Link>
        </div>
      </header>

      <div className="cup-wrap">
        <CuponeraOfertas
          products={SAMPLE_PRODUCTS}
          displayClassName={fraunces.className}
          deal={<DealOfTheDay product={SAMPLE_DEAL} endsAt={endsAt.toISOString()} initialSeconds={initialSeconds} />}
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
                <CouponCard key={c.id} coupon={c} displayClassName={fraunces.className} />
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
              <PreviewLink
                key={p.id}
                href={p.url}
                preview={`Vista previa: aquí se abriría ${p.name} en la tienda de ${p.brand}, con el código NAILFEST.`}
                className="cup-newcard"
              >
                <span className="cup-newcard-photo" style={{ background: p.tint }}>
                  <span className="cup-new">Nuevo</span>
                  <ProductIcon kind={p.icon} color={p.color} size={60} />
                </span>
                <span className="cup-newcard-body">
                  <span className="cup-brandname">{p.brand}</span>
                  <span className="cup-newcard-name">{p.name}</span>
                  <span className="cup-prices">
                    <span className="cup-price">{formatCop(p.price)}</span>
                    {discountPercent(p.price, p.before) > 0 && <span className="cup-before">{formatCop(p.before)}</span>}
                  </span>
                  <span className="cup-newcard-cta">Ver en la tienda →</span>
                </span>
              </PreviewLink>
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

        <footer className="cup-footer">
          <p>Cada compra se hace en la tienda de la marca, con sus precios y condiciones. Nail Fest recibe una comisión por las compras hechas desde la cuponera.</p>
          <div className="cup-footer-side">
            <div className="cup-footer-links">
              <Link href="/">Eventos</Link>
              <Link href="/resenas">Reseñas</Link>
              <Link href="/privacidad">Privacidad</Link>
            </div>
            <span className="cup-footer-tech">Tiendas con tecnología Marcolini</span>
          </div>
        </footer>
      </div>

      <PreviewToast />
    </main>
  );
}
