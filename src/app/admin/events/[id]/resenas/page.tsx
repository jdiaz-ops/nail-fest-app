import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guard";
import { getOrgSettings } from "@/lib/settings";
import { formatDateInTz, utcToZonedInputValue } from "@/lib/dateFormat";
import { publicEventName } from "@/lib/eventDisplayName";
import { countSampleReviews, ensureRaffle, eventReviewStats, parseReviewSummary, reviewsByEdition, reviewUrl, REVIEW_LINK_TAG, winnerMessage } from "@/lib/reviews";
import ReviewModerationList, { type ModerationRow } from "@/components/reviews/ReviewModerationList";
import RaffleBox, { type RaffleWinnerRow } from "./RaffleBox";
import ReviewSummaryBox from "./ReviewSummaryBox";
import SampleReviewsBox from "./SampleReviewsBox";

export const dynamic = "force-dynamic";

// Reseñas del evento: moderation queue, numbers, the sorteo and the Claude
// summary — see lib/reviews.ts. Coordinators moderate; the sorteo's terms
// and draw are ADMIN-only.
export default async function EventReviewsPage({ params }: { params: { id: string } }) {
  const user = await requirePageUser(["ADMIN", "COORDINADOR"]);
  const isAdmin = user.role === "ADMIN";
  const [event, orgSettings] = await Promise.all([db.event.findUnique({ where: { id: params.id } }), getOrgSettings()]);
  if (!event) notFound();
  const { timezone, language } = orgSettings;

  const [stats, raffle, editions, reviews, commentCount, sampleCount] = await Promise.all([
    eventReviewStats(event.id),
    ensureRaffle(event.id),
    reviewsByEdition(),
    db.review.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: "desc" },
      include: { photos: { orderBy: { position: "asc" } }, person: { select: { id: true, firstName: true, lastName: true, city: true } }, registration: { select: { scans: { where: { result: "VALID_FIRST" }, orderBy: { scannedAt: "asc" }, take: 1, select: { scannedAt: true } } } } },
    }),
    db.review.count({ where: { eventId: event.id, status: { not: "HIDDEN" }, comment: { not: null } } }),
    countSampleReviews(event.id),
  ]);

  const dt = (d: Date) => formatDateInTz(d, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }, timezone, language);
  const rows: ModerationRow[] = reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    instagramHandle: r.instagramHandle,
    publishConsent: r.publishConsent,
    raffleOptIn: r.raffleOptIn,
    status: r.status,
    featured: r.featured,
    createdLabel: dt(r.createdAt),
    scannedLabel: r.registration.scans[0] ? dt(r.registration.scans[0].scannedAt) : null,
    personId: r.person.id,
    personName: [r.person.firstName, r.person.lastName].filter(Boolean).join(" ") || "—",
    city: r.person.city,
    photos: r.photos.map((p) => p.url),
    isSample: r.isSample,
  }));

  const eventName = publicEventName(event);
  const winners: RaffleWinnerRow[] = raffle.winners.map((w) => ({
    kind: w.kind,
    position: w.position,
    personName: [w.review.person.firstName, w.review.person.lastName].filter(Boolean).join(" ") || "—",
    phone: w.review.person.phone,
    message: winnerMessage(w.review.person.firstName, eventName, raffle.prizeLabel),
  }));
  const summary = parseReviewSummary(event.reviewSummary);
  const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)} %`);
  const avg = (n: number | null) => (n == null ? "—" : n.toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const sampleLink = reviewUrl("TOKEN-DE-LA-INSCRITA");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Reseñas · {eventName}</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#5b5f6b", maxWidth: 760 }}>Nada se publica sin aprobar. Destaca las que quieras usar en landings, difusiones y tarjetas. Solo pueden reseñar las asistentes escaneadas en puerta.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Stat value={avg(stats.average)} label="promedio" />
        <Stat value={String(stats.count)} label="reseñas recibidas" />
        <Stat value={pct(stats.responseRate)} label={`de ${stats.scanned} escaneadas respondió`} />
        <Stat value={String(stats.withConsent)} label="con permiso de publicar" />
        <Stat value={String(stats.withPhotos)} label="con fotos" />
        <Stat value={String(stats.pending)} label="pendientes de revisar" tone={stats.pending > 0 ? "#8a5a1f" : undefined} />
      </div>

      <details className="report-fold">
        <summary>Cómo pedir la reseña (enlace personal, WhatsApp y correo)</summary>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#17181c", display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
          <p style={{ margin: 0 }}>
            Cada inscrita tiene su enlace personal, con la forma <code>{sampleLink}</code>. Abre con su nombre y su sello de asistencia; a quien no fue escaneada le dice que la reseña es solo para asistentes.
          </p>
          <p style={{ margin: 0 }}>
            <strong>WhatsApp:</strong> crea en Meta una plantilla con un botón de enlace cuya URL termine en <code>{"{{1}}"}</code>, por ejemplo <code>{`${reviewUrl("")}{{1}}`}</code>. Al enviarla desde Difusiones a un segmento "asistió a {eventName}", la app rellena el botón con el token de cada persona, igual que hace con "Ver mi entrada".
          </p>
          <p style={{ margin: 0 }}>
            <strong>Correo:</strong> en Correos del evento, marca "Solo a quienes asistieron" e inserta el enlace con el botón "Insertar enlace de reseña" (la etiqueta <code>{REVIEW_LINK_TAG}</code>).
          </p>
          <p style={{ margin: 0 }}>Esta página no envía nada: tú decides cuándo y por qué canal.</p>
        </div>
      </details>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2.2fr) minmax(280px, 1fr)", gap: 18, alignItems: "start" }} className="reviews-admin-grid">
        <ReviewModerationList rows={rows} />
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ReviewSummaryBox eventId={event.id} summary={summary} generatedLabel={event.reviewSummaryAt ? dt(event.reviewSummaryAt) : null} commentCount={commentCount} />
          <RaffleBox
            eventId={event.id}
            prizeCount={raffle.prizeCount}
            prizeLabel={raffle.prizeLabel}
            closesAtInput={utcToZonedInputValue(raffle.closesAt, timezone)}
            closesLabel={formatDateInTz(raffle.closesAt, { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }, timezone, language)}
            drawnLabel={raffle.drawnAt ? dt(raffle.drawnAt) : null}
            participants={raffle.participants}
            optIns={stats.raffleOptIns}
            winners={winners}
            isAdmin={isAdmin}
          />
          {isAdmin && <SampleReviewsBox eventId={event.id} eventSlug={event.slug} count={sampleCount} />}
          <section style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Comparado con otras ediciones</div>
            {editions.length === 0 ? (
              <div style={{ fontSize: 12.5, color: "#5b5f6b" }}>Todavía no hay reseñas en ningún evento.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5 }}>
                {editions.map((e) => (
                  <div key={e.eventId} style={{ display: "flex", justifyContent: "space-between", gap: 8, color: e.eventId === event.id ? "#17181c" : "#5b5f6b", fontWeight: e.eventId === event.id ? 700 : 400 }}>
                    <span>{e.name}</span>
                    <span style={{ whiteSpace: "nowrap" }}>
                      {avg(e.average)} · {e.count} · {pct(e.responseRate)} respondió
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e3e1dc", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone }}>{value}</div>
      <div style={{ fontSize: 12, color: "#5b5f6b" }}>{label}</div>
    </div>
  );
}
