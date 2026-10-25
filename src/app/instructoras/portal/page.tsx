import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PortalShell from "@/components/portal/PortalShell";
import { ShareLinkButton } from "@/components/portal/PortalActions";
import { PortalIcon, type PortalIconName } from "@/components/portal/icons";
import { db } from "@/lib/db";
import { getLibrarySettings } from "@/lib/library/settings";
import { profileCompleteness, profileStatus } from "@/lib/library/portal";
import { profileAddress, requirePortalPage } from "@/lib/library/portalAuth";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu portal · Instructoras Nail Fest", robots: { index: false, follow: false } };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// nailfest.lat/instructoras/portal — her home: where her profile stands
// (in review, published, paused or hidden by the team), what it's still
// missing, the way to each part of the portal, and the invitation to send
// videos. A profile still being made goes to the onboarding.
export default async function PortalHomePage() {
  const { instructor } = await requirePortalPage();
  const status = profileStatus(instructor);
  if (status === "draft") redirect("/instructoras/portal/bienvenida");

  const [settings, sent, published] = await Promise.all([
    getLibrarySettings(),
    db.instructorVideoSubmission.count({ where: { instructorId: instructor.id } }),
    db.libraryVideo.count({ where: { instructorId: instructor.id, visible: true } }),
  ]);
  const address = profileAddress(instructor.slug);
  const completeness = profileCompleteness(instructor);
  const percent = Math.round((completeness.done / completeness.total) * 100);

  const menu: { href: string; icon: PortalIconName; tone: string; title: string; text: string }[] = [
    { href: "/instructoras/portal/perfil", icon: "person", tone: "bib-tone-mint", title: "Mi perfil", text: "Foto, nombre, ciudad, especialidades y sobre ti" },
    { href: "/instructoras/portal/perfil#redes", icon: "link", tone: "bib-tone-peach", title: "Redes y contacto", text: "Instagram, TikTok, YouTube y WhatsApp" },
    {
      href: "/instructoras/portal/videos",
      icon: "play",
      tone: "bib-tone-lilac",
      title: "Mis videos",
      text: sent || published ? `${plural(sent, "enviado", "enviados")} · ${plural(published, "en El Taller", "en El Taller")}` : "Envía tu primer video",
    },
    { href: "/instructoras/portal/cuenta", icon: "gear", tone: "bib-tone-stone", title: "Cuenta", text: "Usuario, correo, celular y contraseña" },
  ];

  return (
    <PortalShell instructor={instructor} tab="inicio">
      <div className="pt-wrap">
        <h1 className={`pt-h1 ${fraunces.className}`}>Hola, {instructor.name.split(" ")[0]}</h1>

        {status === "live" && (
          <div className="pt-card pt-status">
            <span className="pt-pill pt-pill--live">
              <PortalIcon name="check" size={13} /> Publicado
            </span>
            <span className="pt-url">{address.label}</span>
            {!settings.instructorsPublished && <p>El directorio todavía no está abierto al público: tu perfil se verá ahí cuando abra.</p>}
            <div className="pt-btns">
              <Link href={`/instructoras/${instructor.slug}`} className="bib-btn bib-btn-main bib-btn-sm">
                Ver mi perfil
              </Link>
              <ShareLinkButton url={address.url} name={instructor.name} />
            </div>
          </div>
        )}
        {status === "review" && (
          <div className="pt-card pt-status pt-status--wait">
            <span className="pt-pill pt-pill--review">En revisión</span>
            <p>El equipo de Nail Fest revisa tu perfil antes de publicarlo en el directorio. Mientras tanto, lo puedes seguir cambiando.</p>
            <div className="pt-btns">
              <Link href={`/instructoras/${instructor.slug}`} className="bib-btn bib-btn-line bib-btn-sm">
                Ver cómo queda
              </Link>
            </div>
          </div>
        )}
        {status === "paused" && (
          <div className="pt-card pt-status pt-status--off">
            <span className="pt-pill pt-pill--no">Pausado</span>
            <p>Tu perfil no sale en el directorio. Lo vuelves a mostrar desde Mi perfil, sin perder nada.</p>
            <div className="pt-btns">
              <Link href="/instructoras/portal/perfil" className="bib-btn bib-btn-line bib-btn-sm">
                Ir a Mi perfil
              </Link>
            </div>
          </div>
        )}
        {status === "hidden" && (
          <div className="pt-card pt-status pt-status--off">
            <span className="pt-pill pt-pill--no">No publicado</span>
            <p>El equipo de Nail Fest no publicó tu perfil en el directorio. Si tienes dudas, escríbenos.</p>
          </div>
        )}

        <div className="pt-card">
          <div className="pt-progress-top">
            <span>{percent === 100 ? "Tu perfil está completo" : `Tu perfil está al ${percent} %`}</span>
            <span>
              {completeness.done} de {completeness.total}
            </span>
          </div>
          <div className="pt-meter">
            <span style={{ width: `${percent}%` }} />
          </div>
          {completeness.missing.length > 0 && (
            <span className="pt-hint">
              Te falta: <b>{completeness.missing.join(", ")}</b>. Los perfiles completos se ven primero en el directorio.
            </span>
          )}
        </div>

        <nav className="pt-menu" aria-label="Tu portal">
          {menu.map((m) => (
            <Link key={m.href} href={m.href} className="pt-item">
              <span className={`pt-ic ${m.tone}`}>
                <PortalIcon name={m.icon} />
              </span>
              <span>
                <b>{m.title}</b>
                <small>{m.text}</small>
              </span>
              <span className="pt-chev">
                <PortalIcon name="chev" />
              </span>
            </Link>
          ))}
        </nav>

        <div className="pt-card pt-card--accent">
          <h2 className={`pt-h2 ${fraunces.className}`}>Sé instructora activa</h2>
          <p>Envía tus videos con su ficha. El equipo elige cuáles salen en El Taller, en las redes y en el correo de Nail Fest, con tu nombre y tus redes.</p>
          <Link href="/instructoras/portal/videos#enviar" className="bib-btn bib-btn-main bib-btn-sm">
            Enviar un video
          </Link>
        </div>
      </div>
    </PortalShell>
  );
}
