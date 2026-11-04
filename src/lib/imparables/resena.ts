import type { ReviewPageTexts } from "@/lib/reviewPageTexts";

// Manicuristas Imparables' review page (the team, 2026-11-04): the same page as Nail Fest's (app/resena/[token]), in the
// congress's colors and faces, with the few lines that speak of a door, a fair or a scan said for a virtual congress —
// over the texts the team edits for every event (/admin/resenas/textos). Every confirmed buyer may review it, once
// it's over (lib/reviews.ts); her reward, early access to the next edition.

export const IMPARABLES_REVIEW_TEXTS: Partial<ReviewPageTexts> = {
  seal: "Participó en {{evento}}",
  commentPlaceholder: "Las charlas, lo que aprendiste, lo que vas a poner en práctica en tu negocio…",
  photosHint: "(tus apuntes, tu pantalla en el congreso, tus uñas)",
  formFootnote: "Pueden dejar su reseña quienes compraron su boleta. Se publica después de una revisión del equipo.",
  thanksIntro: "Tu reseña quedó registrada. La revisamos y la publicamos en los próximos días.",
  rewardEyebrow: "Tu recompensa",
  rewardTitle: "Acceso anticipado a la próxima edición",
  rewardText: "Por dejar tu reseña, te avisamos antes que a nadie cuando abramos las boletas de la próxima edición.",
};

/** Before the congress ends: «Tu reseña se abre al terminar el congreso, el domingo 4 de julio.» */
export function reviewNotYet(day: string): string {
  return `Tu reseña se abre al terminar el congreso, el ${day}.`;
}

/** ?estrellas=1…5 from the email's stars: the rating to start from; 0 otherwise. */
export function starsFrom(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;
}
