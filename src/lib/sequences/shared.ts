// What the sequences' editor (a client component) and their engine share —
// no db here. See lib/sequences/engine.ts for how a sequence runs.

export type DelayUnit = "minutes" | "hours" | "days";

export const DELAY_UNITS: { value: DelayUnit; label: string; minutes: number }[] = [
  { value: "minutes", label: "minutos", minutes: 1 },
  { value: "hours", label: "horas", minutes: 60 },
  { value: "days", label: "días", minutes: 1440 },
];

/** A delay in the biggest unit that writes it whole: 2880 → 2 días, 90 → 90 minutos. */
export function splitDelay(minutes: number): { amount: number; unit: DelayUnit } {
  if (minutes > 0 && minutes % 1440 === 0) return { amount: minutes / 1440, unit: "days" };
  if (minutes > 0 && minutes % 60 === 0) return { amount: minutes / 60, unit: "hours" };
  return { amount: minutes, unit: "minutes" };
}

/** «Apenas entra», «2 horas después», «1 día después». */
export function describeDelay(minutes: number): string {
  if (minutes <= 0) return "Apenas entra";
  const { amount, unit } = splitDelay(minutes);
  const word = unit === "days" ? (amount === 1 ? "día" : "días") : unit === "hours" ? (amount === 1 ? "hora" : "horas") : amount === 1 ? "minuto" : "minutos";
  return `${amount} ${word} después`;
}

/** The longest a step can wait after she entered. */
export const MAX_DELAY_MINUTES = 60 * 1440;

/** Where an email's button — or a WhatsApp template's link button — takes her. */
export type LinkTarget = "checkout" | "event";

export const LINK_TARGETS: { value: LinkTarget; label: string }[] = [
  { value: "checkout", label: "Checkout del evento" },
  { value: "event", label: "Página del evento" },
];

/** The tags an email's subject and text can carry, written {{ASÍ}}. */
export const SEQUENCE_EMAIL_TAGS: { key: string; label: string }[] = [
  { key: "NOMBRE", label: "Nombre (primer nombre)" },
  { key: "NOMBRE_COMPLETO", label: "Nombre completo" },
  { key: "EVENTO_NOMBRE", label: "Nombre del evento" },
  { key: "EVENTO_FECHA", label: "Fecha del evento" },
  { key: "ENLACE_CHECKOUT", label: "Enlace al checkout del evento" },
  { key: "ENLACE_EVENTO", label: "Enlace a la página del evento" },
];

/** The event's links, for a WhatsApp template's {{1}}, {{2}}… — next to the app's own merge tags (lib/whatsapp/mergeTags.ts). */
export const SEQUENCE_LINK_TAGS: { key: string; label: string }[] = [
  { key: "ENLACE_CHECKOUT", label: "Enlace al checkout del evento" },
  { key: "ENLACE_EVENTO", label: "Enlace a la página del evento" },
];

/** Messages go out only from 8 a. m. to 9 p. m., in the account's time zone; the rest wait for the morning. */
export const SENDING_HOURS = { from: 8, to: 21 };
