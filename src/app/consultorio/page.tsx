import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityShell from "@/components/community/CommunityShell";
import { getLibrarySettings } from "@/lib/library/settings";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getConsultorioIdentity } from "@/lib/community/auth";
import { listQuestions } from "@/lib/community/data";
import { CONSULTORIO_TABS, CONSULTORIO_TOPICS, answersLabel, isConsultorioTab, isConsultorioTopic, timeAgo, type ConsultorioTab } from "@/lib/community/consultorio";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getLibrarySettings();
  return {
    title: "Consultorio · Nail Fest",
    description: "Pregunta, responde y aprende con otras manicuristas. Las instructoras del directorio también responden.",
    robots: settings.consultorioPublished ? undefined : { index: false, follow: false },
  };
}

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.slice(0, 80) ?? "";

// nailfest.lat/consultorio — the community's questions: the most recent
// activity, the ones nobody answered yet, the most useful; by topic or by
// words. Each one opens its answers (./[slug]); "Haz tu pregunta" is
// ./preguntar. Not public until the team publishes it.
export default async function ConsultorioPage({ searchParams }: { searchParams: SearchParams }) {
  const [settings, staff, identity] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples(), getConsultorioIdentity()]);
  if (!settings.consultorioPublished && !staff) notFound();
  const tabParam = one(searchParams.ver);
  const tab: ConsultorioTab = isConsultorioTab(tabParam) ? tabParam : "recientes";
  const topicParam = one(searchParams.tema);
  const topic = isConsultorioTopic(topicParam) ? topicParam : null;
  const query = one(searchParams.q).trim();
  const questions = await listQuestions({ tab, topic, query });
  const href = (change: Record<string, string | null>) => {
    const params = Object.entries({ ver: tab === "recientes" ? null : tab, tema: topic, q: query || null, ...change })
      .filter((e): e is [string, string] => Boolean(e[1]))
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `/consultorio${params ? `?${params}` : ""}`;
  };
  const filtered = Boolean(topic || query || tab !== "recientes");

  return (
    <CommunityShell
      section="Consultorio"
      identity={identity}
      returnTo="/consultorio"
      note={settings.consultorioPublished ? null : "El Consultorio todavía no es público: el resto de las personas ven «página no encontrada»."}
    >
      <div className="cs-wrap">
        <h1 className={`cs-h1 ${fraunces.className}`}>Consultorio</h1>
        <p className="cs-lede">Pregunta, responde y aprende con otras manicuristas. Las instructoras del directorio también responden.</p>
        <form className="cs-search" role="search" action="/consultorio" method="get">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="cs-q" className="bib-sr">
            Buscar en el Consultorio
          </label>
          <input id="cs-q" name="q" type="search" defaultValue={query} placeholder="Busca: top coat, levantamiento, precios…" enterKeyHint="search" />
          {topic && <input type="hidden" name="tema" value={topic} />}
          {tab !== "recientes" && <input type="hidden" name="ver" value={tab} />}
        </form>
        <nav className="cs-tabs" aria-label="Ordenar las preguntas">
          {CONSULTORIO_TABS.map((t) => (
            <Link key={t.key} href={href({ ver: t.key === "recientes" ? null : t.key })} aria-current={t.key === tab ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>
        <nav className="cs-topics" aria-label="Temas">
          <Link href={href({ tema: null })} aria-current={topic ? undefined : "page"}>
            Todas
          </Link>
          {CONSULTORIO_TOPICS.map((t) => (
            <Link key={t.key} href={href({ tema: t.key })} aria-current={topic === t.key ? "page" : undefined}>
              {t.label}
            </Link>
          ))}
        </nav>

        {questions.length === 0 ? (
          <p className="cs-empty">
            {filtered ? (
              <>
                Nada por aquí todavía. <Link href="/consultorio">Ver todas las preguntas</Link>
              </>
            ) : (
              "Todavía no hay preguntas. ¡Haz la primera!"
            )}
          </p>
        ) : (
          questions.map((q) => (
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
                {q.instructorAnswered && <span className="cs-pill cs-pill--pro">Respondió una instructora</span>}
                {q.author.kind === "TEAM" && <span className="cs-pill cs-pill--team">Equipo Nail Fest</span>}
              </span>
            </Link>
          ))
        )}

        {!identity && (
          <div className="cs-join">
            <b>¿Tienes una pregunta o sabes la respuesta?</b>
            <p>Crea tu cuenta gratis para preguntar, responder y votar las respuestas que te sirvieron.</p>
            <div className="pt-btns">
              <Link href="/cuenta/crear?volver=/consultorio" className="bib-btn bib-btn-main bib-btn-sm">
                Crear mi cuenta
              </Link>
              <Link href="/cuenta/entrar?volver=/consultorio" className="bib-btn bib-btn-line bib-btn-sm">
                Entrar
              </Link>
            </div>
          </div>
        )}
      </div>
      <Link href={topic ? `/consultorio/preguntar?tema=${topic}` : "/consultorio/preguntar"} className="cs-fab">
        + Haz tu pregunta
      </Link>
    </CommunityShell>
  );
}
