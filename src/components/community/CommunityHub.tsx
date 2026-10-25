import Link from "next/link";
import type { Event } from "@prisma/client";
import type { CommunityHome } from "@/lib/community/home";
import { answersLabel, timeAgo } from "@/lib/community/consultorio";
import { publicEventName } from "@/lib/eventDisplayName";
import { formatPercent } from "@/lib/cuponera/shared";
import { youtubeThumbnail } from "@/lib/library/shared";
import { PeopleRow } from "@/components/library/parts";
import { SiteIcon } from "./icons";

const eventDay = new Intl.DateTimeFormat("es-CO", { day: "numeric", timeZone: "America/Bogota" });
const eventMonth = new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "America/Bogota" });

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Under the event's hero, the community's home: the way into each part of
// Nail Fest, then a taste of each — the newest cortos and their topics,
// the Consultorio's latest questions, the cuponera's brands, the
// instructors, the next events. A part shows once it's public.
export default function CommunityHub({ home, titleClass, events }: { home: CommunityHome; titleClass: string; events: Event[] }) {
  // Biblioteca and Cortos together (2026-10-25): one door to learn.
  const tiles = [
    home.library.show && {
      href: "/biblioteca",
      icon: "cortos" as const,
      title: "Biblioteca",
      text: "Cortos, clases completas y grabaciones de maratones, gratis.",
      stat: home.cortos.show && home.cortos.count ? plural(home.cortos.count, "corto", "cortos") : "Gratis",
      tone: "hub-tile--dark",
    },
    home.cuponera.show && {
      href: "/cuponera",
      icon: "tag" as const,
      title: "Descuentos",
      text: "Códigos de tus marcas para comprar más barato.",
      stat: plural(home.cuponera.count, "marca", "marcas"),
      tone: "bib-tone-sand",
    },
    home.consultorio.show && {
      href: "/consultorio",
      icon: "chat" as const,
      title: "Consultorio",
      text: "Pregunta y responde con otras manicuristas.",
      stat: home.consultorio.count ? plural(home.consultorio.count, "pregunta", "preguntas") : null,
      tone: "bib-tone-peach",
    },
    home.instructors.show && {
      href: "/instructoras",
      icon: "people" as const,
      title: "Instructoras",
      text: "Encuentra quién enseña en tu ciudad.",
      stat: home.instructors.count ? plural(home.instructors.count, "instructora", "instructoras") : null,
      tone: "bib-tone-mint",
    },
  ].filter((t): t is Exclude<typeof t, false> => Boolean(t));
  if (tiles.length === 0 && events.length === 0) return null;

  return (
    <section id="comunidad" className="hub" aria-label="La comunidad Nail Fest">
      <div className="hub-inner">
        {tiles.length > 0 && (
          <div className="hub-section">
            <div className="hub-intro">
              <h2 className={titleClass}>Tu lugar Nail Fest</h2>
              <p>Lo que pasa en los eventos sigue aquí todo el año: aprende gratis, ahorra en tus productos, encuentra instructoras y resuelve tus dudas.</p>
            </div>
            <nav className={`hub-tiles hub-tiles--${tiles.length}`} aria-label="La comunidad">
              {tiles.map((t) => (
                <Link key={t.href} href={t.href} className={`hub-tile ${t.tone}`}>
                  <span className="hub-tile-ic">
                    <SiteIcon name={t.icon} size={22} />
                  </span>
                  <b>{t.title}</b>
                  <span>{t.text}</span>
                  {t.stat && <em>{t.stat}</em>}
                </Link>
              ))}
            </nav>
          </div>
        )}

        {home.cortos.show && home.cortos.items.length > 0 && (
          <div className="hub-section">
            <div className="hub-head">
              <h2 className={titleClass}>Cortos para aprender hoy</h2>
              <Link href="/biblioteca/cortos">Ver todos</Link>
            </div>
            <div className="hub-cortos">
              {home.cortos.items.map((c) => (
                <Link key={c.slug} href={`/biblioteca/cortos?v=${c.slug}`} className="hub-corto">
                  <span className={`hub-corto-media bib-ph-${c.tone}`}>
                    {c.youtubeId && (
                      // eslint-disable-next-line @next/next/no-img-element -- YouTube's own still
                      <img src={youtubeThumbnail(c.youtubeId)} alt="" loading="lazy" decoding="async" />
                    )}
                    {c.duration && <span className="hub-dur">{c.duration}</span>}
                  </span>
                  <b>{c.title}</b>
                  {c.instructor && <small>{c.instructor}</small>}
                </Link>
              ))}
            </div>
            {home.cortos.topics.length > 1 && (
              <nav className="hub-chips" aria-label="Cortos por tema">
                {home.cortos.topics.map((t) => (
                  <Link key={t.key} href={`/biblioteca/cortos?tema=${t.key}`}>
                    {t.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        )}

        {home.consultorio.show && (
          <div className="hub-section">
            <div className="hub-head">
              <h2 className={titleClass}>Consultorio</h2>
              <Link href="/consultorio">Ver todas</Link>
            </div>
            {home.consultorio.questions.length > 0 ? (
              <div className="hub-questions">
                {home.consultorio.questions.map((q) => (
                  <Link key={q.id} href={`/consultorio/${q.slug}`} className="cs-q">
                    <b>{q.title}</b>
                    <span className="cs-meta">
                      <span>
                        {q.author.name}
                        {q.author.city ? ` · ${q.author.city}` : ""}
                      </span>
                      <span>{timeAgo(q.lastActivityAt)}</span>
                      <span className={q.answerCount === 0 ? "cs-zero" : "cs-count"}>{answersLabel(q.answerCount)}</span>
                      {q.solved && <span className="cs-pill cs-pill--solved">Resuelta</span>}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="cs-empty">Todavía no hay preguntas. ¡Haz la primera!</p>
            )}
            <Link href="/consultorio/preguntar" className="bib-btn bib-btn-main hub-cta">
              Haz tu pregunta
            </Link>
          </div>
        )}

        {home.cuponera.show && (
          <div className="hub-section">
            <div className="hub-head">
              <h2 className={titleClass}>Descuentos en tus marcas</h2>
              <Link href="/cuponera">Ver la cuponera</Link>
            </div>
            <div className="hub-brands">
              {home.cuponera.brands.map((b) => (
                <Link key={b.id} href="/cuponera" className="hub-brand" aria-label={`${b.name}: ${formatPercent(b.discountPercent)} de descuento`}>
                  {b.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the brand's logo
                    <img src={b.logoUrl} alt="" loading="lazy" />
                  ) : (
                    <span>{b.initial}</span>
                  )}
                  <em>−{formatPercent(b.discountPercent)}</em>
                </Link>
              ))}
            </div>
          </div>
        )}

        {home.instructors.show && (
          <div className="hub-section">
            <div className="hub-head">
              <h2 className={titleClass}>Instructoras</h2>
              <Link href="/instructoras">Ver todas</Link>
            </div>
            <PeopleRow people={home.instructors.people} />
            {home.instructors.joinOpen && (
              <div className="hub-join">
                <span>¿Das clases de uñas? Crea tu perfil gratis en el directorio.</span>
                <Link href="/instructoras/unirme" className="bib-btn bib-btn-line bib-btn-sm">
                  Crear mi perfil
                </Link>
              </div>
            )}
          </div>
        )}

        {events.length > 0 && (
          <div className="hub-section">
            <div className="hub-head">
              <h2 className={titleClass}>Más eventos Nail Fest</h2>
            </div>
            <div className="hub-events">
              {events.map((e) => (
                <Link key={e.id} href={`/${e.slug}`} className="hub-event">
                  <span className="hub-event-date">
                    <b>{eventDay.format(e.startsAt)}</b>
                    <span>{eventMonth.format(e.startsAt).replace(".", "")}</span>
                  </span>
                  <span>
                    <b>{publicEventName(e)}</b>
                    <small>{e.venueName ?? e.city}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
