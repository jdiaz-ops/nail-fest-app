import type { AgendaLandingBlock, FaqLandingBlock, HeadingLandingBlock, LandingBlock, PointsLandingBlock } from "@/lib/landingBlocks/types";
import { GUARANTEE } from "./tiers";

// Manicuristas Imparables «vender la transformación» (the team's instructions,
// 2026-10-31): the page in second person, two sections of its own and the
// questions that sell, only on the page versions listed in
// TRANSFORMATION_VERSIONS (nailfest.lat/v/<slug>). The main page and every
// other version stay as they are. Every word is here, to edit by hand; the
// page reads it from here (withTransformationBlocks, and
// components/imparables/ImparablesPage.tsx for the cover and the closing).

/** The versions that show the page this way. */
export const TRANSFORMATION_VERSIONS = ["2v"];

export function isTransformationVersion(slug: string | null | undefined): boolean {
  return Boolean(slug && TRANSFORMATION_VERSIONS.includes(slug.toLowerCase()));
}

export const TRANSFORMATION = {
  /** A. Right after «¿Qué tienen en común…?», before the speakers; «Nadie nace imparable. Se hace.» moves under it. */
  promise: {
    title: "Tu negocio no va a ser el mismo.",
    text: "Un domingo para llegar a la raíz de lo que te frena. En la mañana vas a escuchar a quienes tuvieron tus mismos miedos y decidieron de todas formas. En la tarde vas a ordenar tus números, encontrar tu esencia, aprender a atraer clientas y a hacer que vuelvan. Sales con tu plan escrito en tu cuaderno, no con notas sueltas.",
  },
  /** C. Over the speakers. */
  speakers: {
    title: "De quién vas a aprender",
    intro: "Elegidos por una razón: todos empezaron donde tú estás hoy y vienen a contarte exactamente qué hicieron.",
  },
  /** B. After the speakers, before the program: six verbs from the talks' own lines. */
  outcomes: {
    eyebrow: "Lo que vas a lograr",
    items: [
      { title: "Vence el miedo que te frena.", text: "Escucha cómo atravesaron las dificultades, tomaron riesgos y vencieron sus miedos quienes hoy tienen el negocio que tú sueñas." },
      { title: "Cobra lo que vales, sin culpa.", text: "Sal sabiendo cuánto cobrar, cuánto gastas y cuánto te queda de verdad." },
      { title: "Encuentra tu esencia.", text: "Descubre lo que te hace única y conviértelo en una marca que tus clientas reconozcan y busquen." },
      { title: "Llena tu agenda.", text: "Del primer mensaje a la cita confirmada: qué publicar y cómo responder." },
      { title: "Haz que vuelvan.", text: "Servicio y experiencia para que cada clienta te elija, regrese y te recomiende." },
      { title: "Atrévete y piensa en grande.", text: "Redes, actitud y orgullo por tu oficio: lo que necesitas para dejar de pensar en pequeño." },
    ],
  },
  /** D. Under each part of the program's header. */
  agenda: {
    morning: "Vas a escuchar cuatro historias que se parecen a la tuya: la mesa alquilada, el miedo a cobrar, el día en que casi lo dejan. Y vas a escribir en tu cuaderno el miedo que desde hoy dejas de usar como excusa.",
    afternoon: "Ahora te toca a ti. Paso a paso, con tus propios números y tu propio Instagram abiertos, vas a armar el plan: cuánto cobrar, cómo verte, cómo atraer, cómo retener. Al final, Oskar cierra y tú firmas tu ruta.",
  },
  /** E. «Todo lo que trae tu boleta», from things to results. */
  takeaways: {
    title: "Lo que te llevas",
    items: [
      { title: "Un día que te cambia la forma de ver tu negocio", text: "9 conferencistas y un panel, de 8 a. m. a 7 p. m., desde tu celular." },
      { title: "Vuelve a verlo cuando lo necesites", text: "Las charlas quedan disponibles 30 días." },
      { title: "Las herramientas de cada conferencista", text: "Guías para aplicar lo que escuchaste." },
      { title: "Tu diploma Imparable 2027", text: "Con tu nombre, para tu salón." },
      { title: "Tu cuaderno «Mi Ruta Imparable»", text: "Lo llenas durante las charlas; sales con tu plan escrito." },
      { title: "Garantía Imparable", text: "Escucha la primera charla y, si no es para ti, te devolvemos el 100 % ese mismo día." },
    ],
  },
  /** F. Before the logistics questions, in this order. */
  questions: [
    {
      question: "¿De verdad vale la pena?",
      answer:
        "Si llevas años trabajando y sientes que el negocio no crece, sí. No es un curso de técnica: es un día para decidir cuánto cobras, cómo te ves, cómo atraes y cómo retienes, con la gente que ya lo hizo. Y si en la primera charla sientes que no es para ti, te devolvemos la plata.",
    },
    {
      question: "¿Por qué pagar por esto si puedo ver videos gratis en Instagram?",
      answer: "Porque en Instagram ves pedazos; aquí ves el camino completo, en orden, con un cuaderno para aterrizarlo a tu negocio y con 500 colegas haciendo lo mismo el mismo día.",
    },
    {
      question: "¿Me sirve si llevo poco tiempo? ¿Y si llevo muchos años?",
      answer: "Sirve si ya tienes clientas y sientes que estás estancada. Las historias de la mañana son para las dos; el plan de la tarde se arma con tus números, lleves uno o quince años.",
    },
    {
      question: "¿Cómo me va a servir dentro de tres meses?",
      answer:
        "Sales con tu ruta escrita: lo que cambias, cuándo y cómo sabrás que funcionó. La página «Mi ruta» del cuaderno se llena el mismo 27 de junio y es lo que vas a revisar a los 90 días.",
    },
    {
      question: "¿Qué me llevo exactamente?",
      answer: "Nueve charlas en vivo, un panel, tu cuaderno con tu plan, las guías de los conferencistas, la repetición por 30 días y tu diploma.",
    },
    {
      question: "¿Cómo hago para no distraerme 11 horas?",
      answer: "El día está armado en bloques de dos charlas con pausas activas, una hora de almuerzo y el cuaderno para escribir mientras escuchas. Y lo que te pierdas lo ves en la repetición.",
    },
    {
      question: "¿Hay garantía?",
      answer: "Sí. Escucha la primera charla y, si a las 9:20 a. m. sientes que no es para ti, escríbenos antes del mediodía y te devolvemos el 100 %.",
    },
  ],
  /** «¿Puedo pedir reembolso?» says this guarantee instead of the 30 minutes'. */
  refund: GUARANTEE.refund,
  /** Under the cover's button, with the shield. */
  guarantee: `${GUARANTEE.title} ${GUARANTEE.line}`,
  /** G. The closing, over its button. */
  closing: {
    title: "Tu momento es ahora.",
    text: "El 27 de junio, 500 manicuristas van a dejar de pensar en pequeño. Decide si vas a ser una de ellas.",
  },
};

const RESULTS_TITLE = "Lo que vas a resolver en un solo día";
const TAKEAWAYS_TITLE = "Todo lo que trae tu boleta";

const isHeading = (b: LandingBlock): b is HeadingLandingBlock => b.type === "heading";

/** The page's blocks on these versions:
 *  - «Lo que vas a resolver en un solo día» and its cards go (their six verbs are «Lo que vas a lograr», from the page);
 *  - the speakers' heading gets its title and its line;
 *  - the program's parts get their paragraph;
 *  - «Todo lo que trae tu boleta» is «Lo que te llevas», with its six results — and the 30 minutes' card goes, the
 *    guarantee being one of them;
 *  - the questions that sell go before the logistics ones, and the refund answer says the guarantee. */
export function withTransformationBlocks(blocks: LandingBlock[]): LandingBlock[] {
  const out: LandingBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!;
    if (block.hidden) {
      out.push(block);
      continue;
    }
    if (isHeading(block) && (block.title.trim() === RESULTS_TITLE || block.eyebrow.trim().toLowerCase() === "resultados")) continue;
    if (block.type === "slides" && block.style === "results") continue;
    if (block.type === "card" && /^garant/i.test(block.eyebrow.trim())) continue;
    if (isHeading(block) && !block.title.trim() && !block.eyebrow.trim() && blocks[i + 1]?.type === "people") {
      out.push({ ...block, title: TRANSFORMATION.speakers.title, intro: TRANSFORMATION.speakers.intro });
      continue;
    }
    if (isHeading(block) && block.title.trim() === TAKEAWAYS_TITLE) {
      out.push({ ...block, title: TRANSFORMATION.takeaways.title });
      continue;
    }
    if (block.type === "points" && isHeading(blocks[i - 1] ?? block) && (blocks[i - 1] as HeadingLandingBlock).title.trim() === TAKEAWAYS_TITLE) {
      out.push({ ...block, items: TRANSFORMATION.takeaways.items.map((item) => ({ ...item })) } as PointsLandingBlock);
      continue;
    }
    if (block.type === "agenda") {
      out.push(withArcParagraphs(block));
      continue;
    }
    if (block.type === "faq") {
      out.push(withSellingQuestions(block));
      continue;
    }
    out.push(block);
  }
  return out;
}

/** The program's parts — its morning, its afternoon — with their paragraph under the header. */
function withArcParagraphs(block: AgendaLandingBlock): AgendaLandingBlock {
  const texts = [TRANSFORMATION.agenda.morning, TRANSFORMATION.agenda.afternoon];
  let part = 0;
  return {
    ...block,
    rows: block.rows.map((row) => {
      if (row.kind !== "day") return row;
      const chip = row.chip.toLowerCase();
      const text = /mañana|manana/.test(chip) ? texts[0] : /tarde/.test(chip) ? texts[1] : texts[part];
      part++;
      return text ? { ...row, takeaway: text } : row;
    }),
  };
}

/** The first list of questions: the ones that sell first, then the logistics ones, the refund one with the guarantee. */
function withSellingQuestions(block: FaqLandingBlock): FaqLandingBlock {
  const ours = TRANSFORMATION.questions.map((q) => ({ ...q }));
  const theirs = block.items
    .filter((item) => !ours.some((q) => q.question === item.question))
    .map((item) => (/reembols|devoluc/i.test(item.question) ? { ...item, answer: TRANSFORMATION.refund } : item));
  return { ...block, items: [...ours, ...theirs] };
}
