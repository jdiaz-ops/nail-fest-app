import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { PortalIcon } from "@/components/portal/icons";
import { getLibraryViewer } from "@/lib/library/data";
import { getPortalUser } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const viewer = await getLibraryViewer();
  return {
    title: "Crea tu perfil de instructora · Nail Fest",
    description: viewer.config.texts.joinLede,
    robots: viewer.config.portalOpen ? undefined : { index: false, follow: false },
  };
}

const INCLUDES = [
  <>
    Tu página en <b>nailfest.lat/instructoras/tuusuario</b>
  </>,
  "Que te encuentren por tu ciudad y por lo que enseñas",
  "Tus redes: Instagram, TikTok y YouTube, y tu WhatsApp si quieres",
  "Gratis. Lo cambias o lo pausas cuando quieras",
];

const STEPS = ["Creas tu cuenta con usuario y contraseña.", "Completas tu perfil en 5 pasos.", "El equipo lo revisa y lo publica."];
// Only while El Taller is public (hidden since 2026-10-25).
const VIDEOS_STEP = "Si quieres, envías tus videos.";

// nailfest.lat/instructoras/unirme — the way in for instructors: what the
// directory gives them, how it works and how Nail Fest earns, and the
// sign-up (./cuenta). While the registration is closed (Editar biblioteca
// → "Registro de instructoras") it says it opens soon; the team can still
// try it.
export default async function UnirmePage() {
  const [viewer, user] = await Promise.all([getLibraryViewer(), getPortalUser()]);
  if (user) redirect("/instructoras/portal");
  const { texts, portalOpen } = viewer.config;
  const open = portalOpen || viewer.staff;
  const videos = viewer.videos;

  return (
    <PortalShell
      aside={
        <Link href="/instructoras/entrar" className="pt-link">
          Entrar
        </Link>
      }
      note={viewer.staff && !portalOpen ? "El registro de instructoras está cerrado: el resto de las personas ven que abre muy pronto." : null}
    >
      <section className="bib-hero pt-hero">
        <div className="bib-hero-inner">
          <span className="pt-kicker">El directorio de instructoras de uñas</span>
          <h1 className={`bib-hero-title ${fraunces.className}`}>{texts.joinTitle}</h1>
          <p className="bib-hero-lede">{texts.joinLede}</p>
          <div className="pt-hero-actions">
            {open ? (
              <Link href="/instructoras/unirme/cuenta" className="bib-btn bib-btn-main">
                Crear mi perfil
              </Link>
            ) : (
              <span className="pt-soon">El registro abre muy pronto.</span>
            )}
            <p className="pt-already">
              ¿Ya tienes cuenta? <Link href="/instructoras/entrar">Entrar</Link>
            </p>
          </div>
        </div>
      </section>

      <div className="pt-wrap">
        <div className="pt-card">
          <h2 className={`pt-h2 ${fraunces.className}`}>Qué incluye</h2>
          {INCLUDES.map((text, i) => (
            <div key={i} className="pt-row">
              <PortalIcon name="check" size={18} />
              <span>{text}</span>
            </div>
          ))}
        </div>
        {videos && (
          <div className="pt-card pt-card--accent">
            <h2 className={`pt-h2 ${fraunces.className}`}>{texts.joinActiveTitle}</h2>
            <p>{texts.joinActiveText}</p>
          </div>
        )}
        <div className="pt-card">
          <h2 className="pt-h3">Cómo funciona</h2>
          <ol className="pt-steps">
            {(videos ? [...STEPS, VIDEOS_STEP] : STEPS).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
        {videos && (
          <div className="pt-card pt-card--soft">
            <h2 className="pt-h3">{texts.joinMoneyTitle}</h2>
            <p>{texts.joinMoneyText}</p>
          </div>
        )}
        {open && (
          <Link href="/instructoras/unirme/cuenta" className="bib-btn bib-btn-main pt-wide">
            Crear mi perfil
          </Link>
        )}
        <p className="pt-center">
          <Link href="/instructoras/terminos">Términos del directorio</Link>
        </p>
      </div>
    </PortalShell>
  );
}
