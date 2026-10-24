import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CommunityShell from "@/components/community/CommunityShell";
import AuthorLine from "@/components/community/AuthorLine";
import { AnswerComposer, BestButton, UsefulButton } from "@/components/community/ConsultorioActions";
import { getLibrarySettings } from "@/lib/library/settings";
import { viewerCanSeeSamples } from "@/lib/reviewsViewer";
import { getConsultorioIdentity, identityLabel } from "@/lib/community/auth";
import { getThread } from "@/lib/community/data";
import { answersLabel, consultorioTopicLabel, timeAgo } from "@/lib/community/consultorio";
import { fraunces } from "@/app/cuponera/fonts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const [settings, staff] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples()]);
  const thread = settings.consultorioPublished || staff ? await getThread(params.slug, null, staff) : null;
  if (!thread) return { title: "Consultorio · Nail Fest", robots: { index: false, follow: false } };
  return {
    title: `${thread.title} · Consultorio Nail Fest`,
    description: thread.body?.slice(0, 160) ?? `${answersLabel(thread.answers.length)} en el Consultorio de Nail Fest.`,
    robots: settings.consultorioPublished && !thread.hidden ? undefined : { index: false, follow: false },
  };
}

// A question of the Consultorio and its answers: «La que me resolvió»
// first, then the most useful. Whoever is signed in answers from the box at
// the bottom; whoever asked marks the one that solved it.
export default async function ConsultorioQuestionPage({ params }: { params: { slug: string } }) {
  const [settings, staff, identity] = await Promise.all([getLibrarySettings(), viewerCanSeeSamples(), getConsultorioIdentity()]);
  if (!settings.consultorioPublished && !staff) notFound();
  const thread = await getThread(params.slug, identity, staff);
  if (!thread) notFound();
  const here = `/consultorio/${thread.slug}`;
  const signIn = identity ? null : `/cuenta/crear?volver=${encodeURIComponent(here)}`;
  const askerName = thread.author.kind === "TEAM" ? null : thread.author.name.split(" ")[0];
  const canPost = Boolean(identity) && (settings.consultorioPublished || identity?.kind === "TEAM");

  return (
    <CommunityShell
      section="Consultorio"
      identity={identity}
      returnTo={here}
      composer={canPost}
      note={settings.consultorioPublished ? null : "El Consultorio todavía no es público: el resto de las personas ven «página no encontrada»."}
    >
      <div className="cs-wrap">
        <Link href="/consultorio" className="cs-back">
          ← Todas las preguntas
        </Link>
        {thread.hidden && <p className="cs-staff">Esta pregunta está oculta: solo la ve el equipo.</p>}
        <article className="cs-question">
          <span className="cs-pill cs-pill--topic">{consultorioTopicLabel(thread.topic)}</span>
          <h1 className={fraunces.className}>{thread.title}</h1>
          {thread.body && <p className="cs-body">{thread.body}</p>}
          {thread.photoUrl && (
            <div className="cs-photo">
              {/* eslint-disable-next-line @next/next/no-img-element -- the photo she uploaded with her question */}
              <img src={thread.photoUrl} alt="La foto de la pregunta" />
            </div>
          )}
          <AuthorLine author={thread.author} when={timeAgo(thread.createdAt)} />
        </article>

        <p className="cs-count-line">
          {answersLabel(thread.answers.length)}
          {thread.answers.length > 1 ? " · primero las que más sirvieron" : ""}
        </p>
        {thread.answers.map((a) => (
          <article key={a.id} id={`respuesta-${a.id}`} className={`cs-answer${a.best ? " cs-answer--best" : a.author.instructor ? " cs-answer--pro" : ""}`}>
            {a.best && (
              <span className="cs-best">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4 4L19 7" />
                </svg>
                {askerName ? `La que le resolvió a ${askerName}` : "La que resolvió la pregunta"}
              </span>
            )}
            <AuthorLine author={a.author} when={timeAgo(a.createdAt)} />
            <p className="cs-body">{a.body}</p>
            <div className="cs-acts">
              <UsefulButton answerId={a.id} count={a.usefulCount} voted={a.voted} mine={a.mine} signInHref={signIn} />
              {thread.canMarkBest && !a.mine && <BestButton questionId={thread.id} answerId={a.id} best={a.best} />}
            </div>
          </article>
        ))}

        {!identity && (
          <div className="cs-join">
            <b>¿Sabes la respuesta?</b>
            <p>Crea tu cuenta gratis para responder y votar las respuestas que te sirvieron. Si eres instructora del directorio, entra con tu cuenta del portal.</p>
            <div className="pt-btns">
              <Link href={`/cuenta/crear?volver=${encodeURIComponent(here)}`} className="bib-btn bib-btn-main bib-btn-sm">
                Crear mi cuenta
              </Link>
              <Link href={`/cuenta/entrar?volver=${encodeURIComponent(here)}`} className="bib-btn bib-btn-line bib-btn-sm">
                Entrar
              </Link>
            </div>
          </div>
        )}
      </div>
      {canPost && identity && <AnswerComposer questionId={thread.id} asLabel={identityLabel(identity)} />}
    </CommunityShell>
  );
}
