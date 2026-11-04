// Manicuristas Imparables' «Boleta Imparable» (the team's boceto, 2026-11-03): the general admission in a card of
// its own, between «Qué incluye tu cupo» and the questions — its name, the ticket drawn (its name, the congress, the
// day and a stub with its bar code), today's price and what it brings in a few short lines, the button and how to
// pay. Every word is here, to edit by hand; the page reads it from here (components/imparables/ImpBoleta.tsx). The
// welcome card and the kit are sent to every buyer but not named here (the team, 2026-11-03).
export const BOLETA = {
  title: "Boleta Imparable",
  /** On the ticket drawn: a small word over its name, its name, and its number (the same on every page). */
  ticket: { kicker: "Boleta", name: "Imparable", number: "Nº 0037", live: "En vivo" },
  /** What it brings, a short line each, in this order. */
  lines: [
    "8 conferencistas en vivo, un domingo completo",
    "4 pausas activas guiadas",
    "Grabación de cada charla disponible por 30 días",
    "Diploma digital con tu nombre",
    "Sorteo de las marcas aliadas",
  ],
  /** Under the button. */
  pay: ["Tarjeta", "PSE", "Nequi", "Pago seguro con Wompi"],
};

/** "2027-07-04" → "04 · 07 · 2027": the stub's date. */
export function stubDate(day: string | undefined): string {
  const [year, month, date] = (day ?? "").split("-");
  return year && month && date ? `${date} · ${month} · ${year}` : "";
}
