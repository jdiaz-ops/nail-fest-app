import type { LandingBlock } from "@/lib/landingBlocks/types";
import { pesos, untilDay, type PriceStage, type SalesState } from "./stages";

// Manicuristas Imparables' ticket levels (the team's instructions, 2026-10-31):
// Imparable — the price stage on sale, as on every page (lib/imparables/
// stages.ts) —, Imparable Círculo and Imparable Élite, these two at a fixed
// price: no stages, no date, no discount. Only on the page versions listed in
// TIERED_VERSIONS (lib/imparables/versions.ts): the main page and every other
// version stay as they are. Everything they say and cost is here, to edit by
// hand: the page, the checkout, the payments, the emails and the admin read it
// from here (the two fixed levels' ticket types follow it on their own,
// lib/imparables/tiersServer.ts).

/** The versions (nailfest.lat/v/<slug>) that sell the three levels. */
export const TIERED_VERSIONS = ["sapate"];

/** Pesos per US dollar for Círculo's and Élite's price in dollars, with PayPal (the team, 2026-10-31: «por ahora una
 * TRM de 3.200»): each one's pesos at this rate, to the nearest whole dollar — 190.000 → US$59, 390.000 → US$122. */
export const USD_RATE = 3_200;
const usdCentsOf = (pesos: number) => Math.round(pesos / USD_RATE) * 100;

export type TierSlug = "imparable" | "circulo" | "elite";

export interface Tier {
  slug: TierSlug;
  name: string;
  /** "stage": the price stage on sale; "fixed": fixedPrice. */
  priceMode: "stage" | "fixed";
  /** Whole pesos. */
  fixedPrice: number | null;
  /** The same in US dollars, in cents, to pay it with PayPal; null: in pesos only. */
  fixedUsdCents: number | null;
  /** How many it sells (paid purchases); null: no cap of its own — Imparable's are its stages'. */
  cap: number | null;
  /** On a computer from left to right, on a phone from the top. */
  order: number;
  /** The small tag over its name, in the «Charla estrella» style; «{precio}» is today's price. */
  badge: string | null;
  /** What it brings besides what the three bring, in bold after «Además:». */
  perks: string[];
  /** Its button on the page. */
  button: string;
  /** Under its name in the checkout's «Tu entrada»: what it brings. */
  checkoutLine: string;
}

/** What the three bring, the same in the three cards and in the same order. */
export const COMMON_PERKS = [
  "9 charlas en vivo: 8 conferencistas y un panel, un domingo completo",
  "Repetición por 30 días",
  "Cuaderno «Mi Ruta Imparable» en PDF",
  "Guías de los conferencistas",
  "Certificado digital de asistencia",
  "Descuentos exclusivos de los conferencistas",
];

const CIRCULO_PERKS = [
  "Sesión privada por Zoom con 3 conferencistas, después del congreso",
  "Grupo de 30 días con Heidy para seguir tu plan",
  "Repetición por 90 días",
  "Fila rápida en un Nail Fest 2027",
];

const ELITE_PERKS = [
  "Mesa de 8 por Zoom con el conferencista que elijas (60 min)",
  "20 minutos a solas con Heidy para revisar tu plan",
  "Entrada VIP con acompañante a todos los Nail Fest 2027",
  "Tu nombre en el cierre del congreso",
];

export const TIERS: Tier[] = [
  {
    slug: "elite",
    name: "Imparable Élite",
    priceMode: "fixed",
    fixedPrice: 390_000,
    fixedUsdCents: usdCentsOf(390_000),
    cap: 20,
    order: 1,
    badge: "20 cupos",
    // Everything Círculo brings, and its own.
    perks: [...CIRCULO_PERKS, ...ELITE_PERKS],
    button: "Reservar Élite",
    checkoutLine:
      "Todo lo de Círculo y además: mesa de 8 con el conferencista que elijas, 20 minutos a solas con Heidy, entrada VIP con acompañante a todos los Nail Fest 2027 y tu nombre en el cierre",
  },
  {
    slug: "circulo",
    name: "Imparable Círculo",
    priceMode: "fixed",
    fixedPrice: 190_000,
    fixedUsdCents: usdCentsOf(190_000),
    cap: null,
    order: 2,
    badge: "★ La más elegida",
    perks: CIRCULO_PERKS,
    button: "Reservar Círculo",
    checkoutLine:
      "Todo lo de Imparable y además: sesión privada por Zoom con 3 conferencistas, grupo de 30 días con Heidy, repetición por 90 días y fila rápida en un Nail Fest 2027",
  },
  {
    slug: "imparable",
    name: "Imparable",
    priceMode: "stage",
    fixedPrice: null,
    fixedUsdCents: null,
    cap: null,
    order: 3,
    badge: null,
    perks: [],
    button: "Reservar mi cupo",
    checkoutLine: "9 charlas en vivo, repetición por 30 días, cuaderno, guías y certificado",
  },
];

/** The section «Elige cómo vivirlo», after «Todo lo que trae tu boleta» and before the questions. */
export const TIERS_SECTION = {
  title: "Elige cómo vivirlo",
  subtitle: "Las tres incluyen las 9 charlas completas. La diferencia es qué tan cerca quieres estar.",
  /** Under a fixed price. */
  fixedNote: "Precio único, no cambia",
  more: "Además:",
  undecided: "¿No sabes cuál? Empieza por Imparable: puedes pasarte a Círculo después pagando solo la diferencia.",
  /** Under the cover's price: to the section. */
  coverLink: "Ver Círculo y Élite",
  /** Élite once its 20 are paid. */
  soldOut: {
    badge: "Élite agotada",
    button: "Avísame si se abre un cupo",
    intro: "Te avisamos si se libera un cupo.",
    done: "Listo: te avisamos si se libera un cupo.",
  },
};

/** «Garantía Imparable»: under the cover's price, under the three cards and in the questions. */
export const GUARANTEE = {
  title: "Garantía Imparable:",
  line: "escucha la primera charla y, si no es para ti, te devolvemos el 100 % ese mismo día.",
  question: "¿Y si no me gusta?",
  answer:
    "Entra el 27 de junio, escucha la charla de Jimena y, si a las 9:20 a. m. sientes que esto no es para ti, escríbenos por WhatsApp antes del mediodía de ese día y te devolvemos el 100 % de lo que pagaste, sin preguntas. Aplica para los tres niveles.",
  /** «¿Puedo pedir reembolso?» on these versions: the same, with this guarantee instead of the 30 minutes. */
  refund: [
    "Sí, en estos casos:",
    "• Garantía Imparable: el 27 de junio escucha la primera charla y, si a las 9:20 a. m. sientes que no es para ti, escríbenos por WhatsApp antes del mediodía y te devolvemos el 100 %.",
    "• Si te arrepientes dentro de los 5 días hábiles siguientes a tu compra, también te devolvemos el 100 %, siempre que el congreso no haya empezado.",
    "• Si Nail Fest cambia la fecha o cancela el congreso, tú eliges: te devolvemos todo o usas tu boleta en la nueva fecha.",
    "Fuera de estos casos no hacemos devoluciones, pero puedes pasarle tu boleta a otra persona escribiéndonos hasta el 25 de junio, y si no puedes verlo en vivo tienes la repetición.",
    "Para pedirlo, escríbenos por WhatsApp con el correo de tu compra; el dinero vuelve por el mismo medio de pago en máximo 30 días.",
  ].join("\n"),
};

/** The checkout's one offer to move from Imparable to Círculo, before paying. */
/** The checkout's «Tu entrada» on these versions (the team's boceto, 2026-10-31): Imparable chosen at the stage on
 * sale, and Círculo and Élite to change it for, as what they add. «{precio}»: the normal price. */
export const CHECKOUT_LEVELS = {
  title: "Tu entrada",
  intro: "Imparable ya incluye las 9 charlas en vivo. Si quieres estar más cerca, cámbiala por Círculo o Élite.",
  normal: "precio normal {precio}",
};

/** Moving up after buying (her link «Pasarme a Círculo», in her confirmation and in her account). */
export const UPGRADE_PAGE = {
  title: "Mejora tu boleta",
  button: "Pasarme a {nivel}",
  pay: "Pagas solo la diferencia: {diferencia}",
  top: "Ya tienes el nivel más alto. Nos vemos el 27 de junio.",
  usd: "Pagaste en dólares: para pasarte de nivel escríbenos por WhatsApp y lo hacemos contigo.",
  tickets: "Tu compra tiene más de una boleta: para pasarte de nivel escríbenos por WhatsApp y lo hacemos contigo.",
  eliteSoldOut: "Élite está agotada.",
};

/** What the emails add for the levels. */
export const TIER_EMAIL = {
  /** «Tu compra» says the level instead of the stage. */
  bought: "Compraste {nivel}",
  /** What comes next, for the two fixed levels. */
  next: {
    circulo:
      "La sesión privada por Zoom con 3 conferencistas es después del congreso: sus fechas te las confirmamos en mayo. Al grupo de 30 días con Heidy entras con un enlace que te mandamos cuando se abra.",
    elite:
      "Tu mesa de 8 con el conferencista que elijas, tus 20 minutos con Heidy y la sesión privada con 3 conferencistas tienen fechas por confirmar en mayo: te escribimos. Al grupo de 30 días con Heidy entras con un enlace que te mandamos cuando se abra. Tu entrada VIP con acompañante vale para todos los Nail Fest 2027.",
  } as Partial<Record<TierSlug, string>>,
  /** Her link to move up, in the confirmation of an Imparable or a Círculo. */
  upgradeLine: "¿Quieres estar más cerca? Pásate de nivel pagando solo la diferencia.",
  upgraded: { subject: "Ya eres {nivel}", lead: "Listo: pasaste a {nivel}." },
  /** Heidy's own email to each Élite, in plain text, right after she pays. */
  welcomeElite: {
    subject: "Bienvenida al grupo de 20",
    text: (firstName: string, help: string | null) =>
      [
        `Hola${firstName ? ` ${firstName}` : ""}:`,
        "",
        "Soy Heidy. Quería escribirte yo misma: acabas de entrar a Imparable Élite, el grupo de 20 personas que van a vivir Manicuristas Imparables más de cerca.",
        "",
        "Esto es lo que viene para ti, además de todo lo de Círculo:",
        "- Una mesa de 8 por Zoom con el conferencista que elijas (60 minutos).",
        "- 20 minutos a solas conmigo para revisar tu plan.",
        "- Entrada VIP con acompañante a todos los Nail Fest 2027.",
        "- Tu nombre en el cierre del congreso.",
        "",
        "En mayo te escribimos con las fechas de las sesiones.",
        help ? `Si tienes cualquier duda, escríbenos por WhatsApp: ${help}` : "",
        "",
        "Nos vemos el 27 de junio.",
        "",
        "Heidy Aristizábal",
      ]
        .filter((line, i, all) => line !== "" || all[i - 1] !== "")
        .join("\n"),
  },
};

// ── How they work ──────────────────────────────────────────────────────────

export function tierBySlug(slug: string | null | undefined): Tier | null {
  return TIERS.find((t) => t.slug === slug) ?? null;
}

/** The name her ticket shows: her level's, when she has one; else her ticket type's. */
export function ticketNameOf(registration: { tierSlug: string | null; ticketType?: { name: string } | null }): string | undefined {
  return tierBySlug(registration.tierSlug)?.name ?? registration.ticketType?.name;
}

/** Whether a version's link sells the levels. */
export function isTieredVersion(slug: string | null | undefined): boolean {
  return Boolean(slug && TIERED_VERSIONS.includes(slug.toLowerCase()));
}

/** The levels in the order the page shows them. */
export function tiersInOrder(): Tier[] {
  return [...TIERS].sort((a, b) => a.order - b.order);
}

/** What a level costs today, in whole pesos: Imparable, the stage on sale; the others, their own price. Null: Imparable
 * with no stage on sale. */
export function tierPrice(tier: Tier, stage: Pick<PriceStage, "price"> | null): number | null {
  return tier.priceMode === "fixed" ? tier.fixedPrice : (stage?.price ?? null);
}

/** «Desde $90.000» and the like: a badge with today's price in it. */
export function tierBadge(tier: Tier, stage: Pick<PriceStage, "price"> | null): string | null {
  if (!tier.badge) return null;
  if (!tier.badge.includes("{precio}")) return tier.badge;
  return stage ? tier.badge.replace("{precio}", pesos(stage.price)) : null;
}

/** Levels by rank: moving up goes to a higher one. */
const RANK: Record<TierSlug, number> = { imparable: 0, circulo: 1, elite: 2 };

export function isHigherTier(target: TierSlug, current: TierSlug): boolean {
  return RANK[target] > RANK[current];
}

/** The levels above `current`, lowest first. */
export function tiersAbove(current: TierSlug): Tier[] {
  return TIERS.filter((t) => RANK[t.slug] > RANK[current]).sort((a, b) => RANK[a.slug] - RANK[b.slug]);
}

/** What moving up to `target` costs someone who paid `paidPesos` in all: the difference, never below zero. */
export function upgradeDifference(paidPesos: number, target: Tier): number {
  return Math.max(0, (target.fixedPrice ?? 0) - paidPesos);
}

/** Whether a level still has places: `paid` purchases against its cap. */
export function tierAvailable(tier: Tier, paid: number): boolean {
  return tier.cap === null || paid < tier.cap;
}

/** «{nivel}», «{diferencia}», «{precio}» in a text. */
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);
}

// ── The stage's counter on these versions (the team's instructions, 2026-10-31) ──

/** Under 30% of the stage's places left, the counter shows; above, only the stage's line. */
const COUNTER_FROM_SHARE_LEFT = 0.3;

/** "18 de abril", "200 cupos" kept on one line wherever the line breaks. */
const together = (text: string) => text.replace(/ /g, "\u00a0");

/** The counter, once fewer than 30% of the stage's places are left: «Etapa Creyente · quedan 56 de 200 cupos a
 * $90.000» (the team's boceto, 2026-10-31), and how full it is for its bar. Null while more are left, or for a stage
 * with no cap. */
export function tierCounter(sales: Pick<SalesState, "current">): { text: string; share: number; left: number } | null {
  const stage = sales.current;
  if (!stage || stage.cap === null || stage.cap <= 0) return null;
  const taken = Math.min(stage.paid, stage.cap);
  const left = stage.cap - taken;
  if (left >= stage.cap * COUNTER_FROM_SHARE_LEFT) return null;
  const share = taken / stage.cap;
  const places = `${left === 1 ? "queda" : "quedan"} ${left} de ${together(`${stage.cap} cupos`)}`;
  return { text: `${stage.name} · ${places} a ${pesos(stage.price)}`, share, left };
}

/** Under the cover's button on these versions (the team's boceto, 2026-10-31), while the counter doesn't show: the
 * stage and its places — «Etapa Creyente» · «Solo 200 cupos a $90.000» —; and, under it or the counter, the normal
 * price and when it goes up — «Precio normal $150.000. Después del 18 de abril, o cuando se acaben los 200 cupos, sube a
 * $120.000.» Each part only when the stages have it. */
export function tierDeal(
  sales: Pick<SalesState, "current" | "next" | "full">,
  timezone: string
): { stage: string; offer: string; then: string | null } | null {
  const stage = sales.current;
  if (!stage) return null;
  const places = stage.cap !== null ? together(`${stage.cap} cupos`) : null;
  const offer = places ? `Solo ${places} a ${pesos(stage.price)}` : pesos(stage.price);
  const normal = sales.full && sales.full.id !== stage.id && sales.full.price > stage.price ? `Precio normal ${pesos(sales.full.price)}.` : null;
  let rise: string | null = null;
  if (sales.next) {
    const date = stage.closesAt ? `Después del ${together(untilDay(stage.closesAt, timezone))}` : null;
    const when = date && places ? `${date}, o cuando se acaben los ${places},` : date ? date : places ? `Cuando se acaben los ${places},` : "Luego";
    rise = `${when} sube a ${pesos(sales.next.price)}.`;
  }
  return { stage: stage.name, offer, then: [normal, rise].filter(Boolean).join(" ") || null };
}

/** The 30 minutes' guarantee, wherever the page says it (the template's card and doubt, as the team may have them). */
const OLD_GUARANTEE = /30\s*minutos|media hora/i;

/** The page on these versions: the Garantía Imparable instead of the 30 minutes' wherever the page says it — a card,
 * a doubt's note — and «¿Y si no me gusta?» right before «¿Puedo pedir reembolso?», whose answer says this guarantee
 * instead of the 30 minutes (or, with no such question, last in the first list of them). */
export function withTierBlocks(blocks: LandingBlock[]): LandingBlock[] {
  let added = false;
  const line = `${GUARANTEE.title} ${GUARANTEE.line}`;
  return blocks.map((block) => {
    if (block.type === "card" && OLD_GUARANTEE.test(`${block.eyebrow} ${block.html}`)) {
      const sentence = GUARANTEE.line.charAt(0).toUpperCase() + GUARANTEE.line.slice(1);
      return { ...block, eyebrow: GUARANTEE.title.replace(/:$/, ""), html: `<p>${sentence}</p>` };
    }
    if (block.type === "slides" && block.items.some((item) => OLD_GUARANTEE.test(item.note))) {
      return { ...block, items: block.items.map((item) => (OLD_GUARANTEE.test(item.note) ? { ...item, noteLabel: "", note: line } : item)) };
    }
    if (block.type !== "faq" || block.hidden || added) return block;
    const items = [...block.items];
    const refund = items.findIndex((item) => /reembols|devoluc/i.test(item.question));
    const ours = { question: GUARANTEE.question, answer: GUARANTEE.answer };
    if (refund >= 0) items.splice(refund, 1, ours, { ...items[refund]!, answer: GUARANTEE.refund });
    else items.push(ours);
    added = true;
    return { ...block, items };
  });
}
