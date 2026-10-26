import { emptyAgendaRow, type AgendaRow, type LandingBlock } from "@/lib/landingBlocks/types";

// «Usar la plantilla de Manicuristas Imparables» (EventForm.tsx →
// /api/admin/events/[id]/plantilla-imparables, 2026-10-26): the page of the
// approved boceto, as ordinary blocks the team edits like any other event's —
// the cover's group photo, the hook, the 3 results, the 8 speakers, the
// panel, the host, the two days' program, what the ticket includes, who it
// is for, the prices with the guarantee, the doubts, the questions and the
// sponsors (hidden until there are logos). Plus the event's own lines
// (tagline, closing, button and the line under the cover's countdown) and
// its three price stages as ticket types. The panelists aren't confirmed yet: no one made up, each
// card says «Por anunciar» (IMPARABLES_PANELISTS); the speakers' photos are
// their Instagram profile pictures (public/imparables/), to be replaced by
// better ones from the editor.

const PHOTO = (name: string) => `/imparables/${name}.jpg`;
// The host's card (the team's text, 2026-10-26, may still be adjusted).
const HOST = {
  name: "Heidy Aristizábal",
  handle: "@hlacosedora",
  bio: "Empezó haciendo uñas en un puesto alquilado. Hoy es cofundadora de H La Cosedora, Nail Fest y Guerra de Pinceles, tiene un récord Guinness y pasó por Shark Tank. Más de 10 años impulsando a la comunidad de uñas.",
  photo: PHOTO("heidy"),
};

// Each speaker's texts in one place (the team's update, 2026-10-26): the line
// on her card (`tag`), her talk's title (`talk`), which the program shows
// under her name, and the talk's subtitle when it has one (`subtitle`, the
// program row's «Nota extra»). The team edits them later in «Contenido».
interface ImparablesSpeaker {
  name: string;
  handle: string;
  tag: string;
  talk: string;
  subtitle?: string;
  photoUrl: string;
}

export const IMPARABLES_SPEAKERS: ImparablesSpeaker[] = [
  {
    name: "Jimena",
    handle: "@jimenanails",
    tag: "La manicurista que se convirtió en empresaria. Fundadora de JimenaNails, 10 años construyendo su marca y a sí misma.",
    talk: "De la mesa a una marca internacional",
    photoUrl: PHOTO("jimena"),
  },
  {
    name: "Pau",
    handle: "@soypauc_tuprofe",
    tag: "De la mesa a CEO de El Imperio de las Uñas, una cadena de 7 spas.",
    talk: "Créete el cuento y cobra lo que vales",
    photoUrl: PHOTO("pau"),
  },
  {
    name: "Juan Tenorio",
    handle: "@don.juantenorio",
    tag: "Asesor de negocios de belleza, con más de 500 salones y barberías transformados.",
    talk: "Tu salón factura, pero ¿cuánto te queda?",
    photoUrl: PHOTO("juan"),
  },
  {
    name: "Cris Sierra",
    handle: "@cris_sierra17",
    tag: "Fundadora de Cristina Sierra Nail Experts: 10 sedes y más de un millón de seguidores. Una historia de superación.",
    // Provisional title, still to be confirmed.
    talk: "La historia detrás de 10 sedes",
    photoUrl: PHOTO("cris"),
  },
  {
    name: "Maris",
    handle: "@maris_nails_oficial",
    tag: "De empezar desde nada en otro país a formar educadoras en toda Chile. Te enseña a vencer el miedo y atreverte a mostrarte.",
    talk: "Empezar de cero en otro país y atreverse a mostrarse",
    photoUrl: PHOTO("maris"),
  },
  {
    name: "Fabi",
    handle: "@fabiversatill",
    tag: "Estratega de centros de belleza. Te enseña a llenar tu agenda con estrategias y contenido que traen clientas.",
    talk: "Agenda llena: estrategias y contenido que traen clientas",
    photoUrl: PHOTO("fabi"),
  },
  {
    name: "Alejandro Salinas",
    handle: "@salinas.beautybusiness",
    tag: "Asesor de negocios de belleza, 15 años en administración, finanzas y marketing. Te muestra cómo usar la IA para ganar tiempo y clientas.",
    talk: "IA para tu negocio: menos horas, más clientas",
    photoUrl: PHOTO("salinas"),
  },
  {
    name: "Oskar",
    handle: "@oskarivanquebelleza",
    tag: "Te contagia la energía para creértela y sobresalir: visión, redes y la ruta final.",
    talk: "Piensa en grande y hazte ver",
    subtitle: "Visión, redes y la actitud para sobresalir.",
    photoUrl: PHOTO("oskar"),
  },
];

// The panel's four guests (the team's update, 2026-10-26): none confirmed
// yet, so no one is made up — each card shows a silhouette, «Por anunciar»
// and the story she brings (`story`, the card's line). Once one is
// confirmed, her name, Instagram and photo go here (or in the event's
// «Contenido») and her card shows them instead.
interface ImparablesPanelist {
  name: string;
  handle: string;
  photoUrl: string;
  story: string;
}

export const IMPARABLES_PANELISTS: ImparablesPanelist[] = [
  { name: "", handle: "", photoUrl: "", story: "La que dejó de cobrar barato" },
  { name: "", handle: "", photoUrl: "", story: "La que pasó de su casa a su propio local" },
  { name: "", handle: "", photoUrl: "", story: "La que salió de deudas y ordenó su plata" },
  { name: "", handle: "", photoUrl: "", story: "La que volvió a empezar desde cero" },
];
const PANEL_TONES = ["pink", "teal", "peach", "pink"] as const;

const session = (chip: string, fields: Partial<AgendaRow>): AgendaRow => ({ ...emptyAgendaRow("session"), chip, ...fields });
const day = (chip: string, topic: string, text: string, takeaway: string): AgendaRow => ({ ...emptyAgendaRow("day"), chip, topic, text, takeaway });
const pause = (chip: string) => session(chip, { topic: "Pausa activa" });
const speaker = (chip: string, name: string, star = false) => {
  const s = IMPARABLES_SPEAKERS.find((sp) => sp.name === name);
  return session(chip, { instructor: name, topic: s?.talk ?? "", text: s?.subtitle ?? "", photoUrl: s?.photoUrl ?? "", star });
};

// The cover's group photo: the speakers and Heidy, cut out of their photos (2026-10-26).
export const IMPARABLES_GROUP_PHOTO = "/imparables/grupo.webp";
const withHost = (chip: string, topic: string, text: string) => session(chip, { topic, text, photoUrl: HOST.photo });

export const IMPARABLES_REFUND =
  "Sí, de dos formas. Si en los primeros 30 minutos del primer día sientes que el congreso no es para ti, escríbenos y te devolvemos el 100%, sin preguntas. Y dentro de los 5 días hábiles siguientes a tu compra también te devolvemos el 100%, siempre que el congreso no haya empezado. Fuera de eso no hacemos devoluciones, pero puedes pasarle tu boleta a otra persona escribiéndonos hasta el 25 de junio, y si no puedes verlo en vivo tienes la repetición por 30 días. Si Nail Fest cambia la fecha o cancela el congreso, tú eliges: te devolvemos todo o usas tu boleta en la nueva fecha. Para pedirlo, escríbenos por WhatsApp con el correo de tu compra; el dinero vuelve por el mismo medio de pago en máximo 30 días.";

export const IMPARABLES_BLOCKS: LandingBlock[] = [
  // La foto grupal de la portada: la imagen antes del primer título
  { type: "image", url: IMPARABLES_GROUP_PHOTO, caption: "" },

  // El gancho
  {
    type: "heading",
    eyebrow: "Por qué ahora",
    title: "La técnica ya no es suficiente.",
    intro: "Haces uñas hermosas. Pero cobrar lo que vales, llenar tu agenda y hacer crecer tu negocio no te lo enseñó nadie.",
    // Hidden at the team's request (2026-10-26): kept in the editor, off the page.
    hidden: true,
  },
  { type: "card", eyebrow: "Ellas empezaron donde tú estás hoy:", title: "en una mesa de manicure.", html: "", icon: "none", tone: "pink", imageUrl: "", hidden: true },

  // Los 3 resultados, en tarjetas que se deslizan
  { type: "heading", eyebrow: "Resultados", title: "Lo que vas a resolver en estos dos días", intro: "" },
  {
    type: "slides",
    style: "results",
    items: [
      {
        tag: "Más clientas",
        title: "Llena tu agenda sin depender del voz a voz",
        text: "Redes que atraen clientas, tu marca y marketing con inteligencia artificial.",
        noteLabel: "Sales sabiendo",
        note: "qué publicar primero.",
        who: "Fabi, Alejandro Salinas y Oskar",
        icon: "none",
      },
      {
        tag: "Más ganancia",
        title: "Cobra lo que vales, sin culpa",
        text: "Cuánto cobrar, cuánto ahorrar y cómo hablar de plata con tus clientas.",
        noteLabel: "Sales sabiendo",
        note: "cuánto debe dejarte cada servicio.",
        who: "Juan Tenorio, Pau y el panel",
        icon: "none",
      },
      {
        tag: "Tu negocio",
        title: "De la mesa a dueña de tu marca",
        text: "Pasar de atender sola a tener salón, equipo o academia, y empezar de cero si te toca.",
        noteLabel: "Sales sabiendo",
        note: "cuál es tu primer paso.",
        who: "Jimena, Cris Sierra y Maris",
        icon: "none",
      },
    ],
  },

  // Speakers, el panel y la maestra de ceremonias
  { type: "heading", eyebrow: "Speakers", title: "Ya lo lograron. Ahora te cuentan cómo.", intro: "" },
  { type: "people", items: IMPARABLES_SPEAKERS.map(({ name, handle, tag, photoUrl }) => ({ name, handle, tag, photoUrl, tone: "pink" as const })) },
  {
    type: "card",
    eyebrow: "Panel · Lunes 28 · 12:05 p. m.",
    title: "El día que decidí cambiar",
    html: "<p>Cuatro manicuristas cuentan la decisión que transformó su negocio y su vida.</p><p><em>Su antes, el momento del quiebre, su después y el consejo que te darían hoy.</em></p>",
    icon: "none",
    tone: "pink",
    imageUrl: "",
  },
  {
    type: "people",
    items: IMPARABLES_PANELISTS.map((p, i) => ({ name: p.name, handle: p.handle, tag: p.story, photoUrl: p.photoUrl, tone: PANEL_TONES[i % PANEL_TONES.length]! })),
  },
  {
    type: "card",
    eyebrow: "Maestra de ceremonias",
    title: HOST.name,
    html: `<p>${HOST.handle}</p><p>${HOST.bio}</p>`,
    icon: "none",
    tone: "pink",
    imageUrl: HOST.photo,
  },

  // La agenda: todo cabe de 9:00 a. m. a 2:00 p. m.
  { type: "heading", eyebrow: "Agenda", title: "Dos días que cambian tu negocio", intro: "" },
  {
    type: "agenda",
    rows: [
      day(
        "Domingo 27 de junio",
        "De la mesa a empresaria",
        "9:00 a. m. a 2:00 p. m.",
        "cuánto cobrar sin culpa y el camino para pasar de la mesa a tu propia marca."
      ),
      withHost("9:00 a. m.", "Bienvenida", "Con Heidy Aristizábal, maestra de ceremonias"),
      speaker("9:15 a. m.", "Jimena", true),
      pause("10:15 a. m."),
      speaker("10:25 a. m.", "Pau"),
      pause("11:25 a. m."),
      speaker("11:40 a. m.", "Juan Tenorio"),
      pause("12:40 p. m."),
      speaker("12:50 p. m.", "Cris Sierra"),
      withHost("1:50 p. m.", "Cierre y sorteo", "Con Heidy Aristizábal"),
      day(
        "Lunes 28 de junio",
        "Sobresalir y pasar a la acción",
        "9:00 a. m. a 2:00 p. m.",
        "cómo mostrarte y llenar tu agenda, con contenido e IA, y el empujón para dar tu siguiente paso."
      ),
      withHost("9:00 a. m.", "Repaso", "Con Heidy Aristizábal"),
      speaker("9:05 a. m.", "Maris"),
      pause("9:55 a. m."),
      speaker("10:05 a. m.", "Fabi"),
      pause("10:55 a. m."),
      speaker("11:05 a. m.", "Alejandro Salinas"),
      pause("11:55 a. m."),
      session("12:05 p. m.", { topic: "Panel «El día que decidí cambiar»", text: "Cuatro historias reales de transformación", star: true }),
      pause("12:50 p. m."),
      speaker("1:00 p. m.", "Oskar"),
      withHost("1:50 p. m.", "Cierre y anuncio de la próxima edición", "Con Heidy Aristizábal"),
    ],
  },

  // Qué incluye
  { type: "heading", eyebrow: "Qué incluye", title: "Todo lo que trae tu boleta", intro: "" },
  {
    type: "points",
    tone: "pink",
    items: [
      { title: "2 días en vivo", text: "" },
      { title: "8 speakers y un panel", text: "" },
      { title: "Pausas activas", text: "" },
      { title: "Guías de los speakers para descargar", text: "" },
      { title: "Repetición por 30 días", text: "" },
      { title: "Certificado digital de asistencia con tu nombre", text: "" },
      { title: "Descuentos exclusivos de los speakers", text: "" },
      { title: "Tu hoja de ruta personal al final", text: "" },
    ],
  },

  // ¿Es para ti?
  { type: "heading", eyebrow: "Para quién es", title: "¿Es para ti?", intro: "" },
  {
    type: "card",
    eyebrow: "Es para ti si…",
    title: "",
    html:
      "<ul><li>Eres manicurista y quieres dejar de depender solo del voz a voz para conseguir clientas.</li><li>Ya tienes clientas, pero sientes que no cobras lo que vales.</li><li>Sueñas con tener tu propio salón, tu marca o tu academia.</li><li>Estás estudiando y quieres empezar con bases de negocio, no solo de técnica.</li></ul>",
    icon: "none",
    tone: "teal",
    imageUrl: "",
  },
  {
    type: "card",
    eyebrow: "No es para ti si…",
    title: "",
    html:
      "<ul><li>Buscas aprender una técnica nueva de uñas: este congreso es de negocio, no de técnica.</li><li>Buscas una fórmula mágica sin poner en práctica nada de lo que aprendas.</li></ul>",
    icon: "none",
    tone: "pink",
    imageUrl: "",
  },

  // Tu boleta: las etapas de precio salen de las entradas del evento
  { type: "heading", eyebrow: "Tu boleta", title: "Entre más temprano, menos pagas", intro: "" },
  { type: "prices", note: "IVA del 19% incluido" },
  {
    type: "card",
    eyebrow: "Garantía sin preguntas",
    title: "Si no es para ti, te devolvemos tu dinero",
    html: "<p>Si en los primeros 30 minutos del primer día sientes que esto no es para ti, escríbenos y te devolvemos el 100%. Sin preguntas.</p>",
    icon: "shield",
    tone: "teal",
    imageUrl: "",
  },

  // Las dudas, en su propia voz: una respuesta y una prueba real
  { type: "heading", eyebrow: "Si todavía dudas", title: "¿Todavía lo estás pensando?", intro: "" },
  {
    type: "slides",
    style: "doubts",
    items: [
      {
        tag: "",
        title: "No tengo tiempo.",
        text: "Son dos mañanas, de 9:00 a. m. a 2:00 p. m., desde tu celular. Y si no puedes en vivo, tienes la repetición por 30 días.",
        noteLabel: "Incluido",
        note: "La repetición por 30 días viene con tu boleta.",
        who: "",
        icon: "clock",
      },
      {
        tag: "",
        title: "Apenas estoy empezando.",
        text: "Es de negocio, no de técnica: te sirve desde tu primera clienta.",
        noteLabel: "Prueba",
        note: "Pau empezó en una mesa de manicure y hoy es CEO de El Imperio de las Uñas.",
        who: "Pau",
        icon: "none",
      },
      {
        tag: "",
        title: "Mi caso es distinto.",
        text: "Hay caminos de todo tipo: independiente, salón, cadena, academia, y empezar de cero en otro país.",
        noteLabel: "Prueba",
        note: "Maris empezó desde nada y hoy forma educadoras en Chile.",
        who: "Maris",
        icon: "none",
      },
      {
        tag: "",
        title: "Ya hice cursos y no me sirvieron.",
        text: "Aquí no hay teoría: te cuentan cómo lo hicieron manicuristas que empezaron donde tú estás.",
        noteLabel: "Garantía",
        note: "Si en los primeros 30 minutos no es para ti, te devolvemos el 100%.",
        who: "",
        icon: "shield",
      },
    ],
  },

  // Preguntas frecuentes
  { type: "heading", eyebrow: "Preguntas frecuentes", title: "Lo que te estás preguntando", intro: "" },
  {
    type: "faq",
    title: "",
    items: [
      {
        question: "¿Cómo me conecto?",
        answer:
          "Por Zoom. En el celular descargas la app gratis una sola vez y entras con tu enlace personal, que te llega por correo y por WhatsApp; antes de empezar te mandamos recordatorios. También puedes verlo desde el computador.",
      },
      { question: "¿Y si no puedo verlo en vivo?", answer: "Tienes la repetición de todo el congreso durante 30 días, para verlo cuando puedas." },
      {
        question: "¿Necesito experiencia?",
        answer:
          "No. Es para manicuristas que ya trabajan y quieren crecer, y también para las que están empezando o estudiando. No es un curso de técnica: es de negocio, con precios, clientas, redes y dinero.",
      },
      {
        question: "¿Sirve si estoy fuera de Colombia?",
        answer:
          "Sí. Es 100% en vivo por Zoom, así que lo ves desde cualquier país. Las horas de la agenda están en hora Colombia y debajo te mostramos la de tu ciudad. Si necesitas ayuda para pagar desde afuera, escríbenos por WhatsApp.",
      },
      {
        question: "¿Cómo pago?",
        answer: "En línea, con Wompi: tarjeta de crédito o débito, PSE o Nequi. Apenas se confirma el pago te llega la confirmación a tu correo.",
      },
      { question: "¿La boleta incluye IVA?", answer: "Sí. El precio que ves ya incluye el IVA del 19%; no hay cobros adicionales." },
      { question: "¿Puedo pedir reembolso?", answer: IMPARABLES_REFUND },
    ],
  },

  // Patrocinadores: ocultos hasta que haya logos
  { type: "heading", eyebrow: "Con el apoyo de", title: "Nuestros patrocinadores", intro: "", hidden: true },
  { type: "gallery", layout: "grid", items: [], showFirst: 0, zoom: false, moreLabel: "", hidden: true },
];

/** The event's own lines, set by the template only where the event has none of its own. */
export const IMPARABLES_FIELDS = {
  subtitle: "<p>Tienes el talento. Ya es hora de construir un negocio que crece.</p>",
  closingText: "Tienes el talento. Ahora, a construir tu negocio.",
  registerButtonLabel: "Quiero mi boleta",
  // «Texto debajo del botón»: on this cover, under the button with a shield —
  // what makes buying risk-free.
  ctaNote: "Garantía sin preguntas: si en los primeros 30 minutos del congreso sientes que no es para ti, te devolvemos el 100%.",
};

/** The price stages, as ticket types (only for an event with none yet). Dates are Bogotá's.
 * No waiting list (2026-10-26): Etapa 1 is on sale from the moment the
 * event is published, no start date. Plain words, no «preventa» or «early
 * bird»: three stages and the regular price, which is real — what it costs
 * to come in on the congress's two days — so each stage tells what it saves
 * against it (lib/imparables/stages.ts). */
export const IMPARABLES_STAGES: { name: string; price: number; opensAt: string | null; closesAt: string }[] = [
  { name: "Etapa 1", price: 80_000, opensAt: null, closesAt: "2027-04-01T00:00:00-05:00" },
  { name: "Etapa 2", price: 100_000, opensAt: "2027-04-01T00:00:00-05:00", closesAt: "2027-06-21T00:00:00-05:00" },
  { name: "Etapa 3", price: 120_000, opensAt: "2027-06-21T00:00:00-05:00", closesAt: "2027-06-27T00:00:00-05:00" },
  { name: "Precio normal", price: 150_000, opensAt: "2027-06-27T00:00:00-05:00", closesAt: "2027-06-28T14:00:00-05:00" },
];
/** Room in each stage: a cap that won't be the limit, to lower once Zoom's capacity is known. */
export const IMPARABLES_STAGE_QUANTITY = 3000;
