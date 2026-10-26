import { emptyAgendaRow, type AgendaRow, type LandingBlock } from "@/lib/landingBlocks/types";

// «Usar la plantilla de Manicuristas Imparables» (EventForm.tsx →
// /api/admin/events/[id]/plantilla-imparables, 2026-10-26): the page of the
// approved boceto, as ordinary blocks the team edits like any other event's —
// the cover's group photo, the hook, the 8 speakers, the panel, the host, the
// two days' program, the 3 results, what the ticket includes, who it is for,
// the prices with the guarantee, the doubts, the questions and the sponsors
// (hidden until there are logos). Plus the event's own lines
// (tagline, closing, button and the line under the cover's countdown) and
// its three price stages as ticket types. The panelists aren't confirmed yet: no one made up, each
// card says «Por anunciar» (IMPARABLES_PANELISTS); the speakers' photos are
// their Instagram profile pictures (public/imparables/), to be replaced by
// better ones from the editor (Karen's, still to come, shows her initial).

const PHOTO = (name: string) => `/imparables/${name}.jpg`;
// The host's card (the team's text, 2026-10-26, may still be adjusted).
const HOST = {
  name: "Heidy Aristizábal",
  handle: "@hlacosedora",
  bio: "Empezó haciendo uñas en un puesto alquilado. Hoy es cofundadora de H La Cosedora, Nail Fest y Guerra de Pinceles, tiene un récord Guinness y pasó por Shark Tank. Más de 10 años impulsando a la comunidad de uñas.",
  photo: PHOTO("heidy"),
};

// Each speaker's texts in one place (the team's update, 2026-10-26): the line
// on her card (`tag`, all of about the same length, so the cards keep their
// proportions), her talk's title (`talk`), which the program shows under her
// name, and the talk's subtitle (`subtitle`, the program row's «Nota extra»).
// In the order of the cards. The team edits them later in «Contenido».
interface ImparablesSpeaker {
  name: string;
  handle: string;
  tag: string;
  talk: string;
  subtitle: string;
  photoUrl: string;
}

export const IMPARABLES_SPEAKERS: ImparablesSpeaker[] = [
  {
    name: "Jimena Montalban",
    handle: "@jimenanails",
    tag: "La manicurista que se convirtió en empresaria. Fundadora de JimenaNails, 10 años construyendo su marca y a sí misma.",
    talk: "Lo que nadie te cuenta de crecer",
    subtitle: "Las decisiones y los riesgos que la llevaron de la mesa de manicure a una marca internacional.",
    photoUrl: PHOTO("jimena"),
  },
  {
    name: "Paula Chacón",
    handle: "@soypauc_tuprofe",
    tag: "De la mesa de manicure a CEO de El Imperio de las Uñas, una cadena de 7 spas. Aprendió a cobrar sin culpa y a delegar.",
    talk: "Créete el cuento: cobra lo que vales y deja de hacerlo todo sola",
    subtitle: "Los miedos que tuvo que vencer: cobrar sin culpa, delegar y armar un equipo.",
    photoUrl: PHOTO("pau"),
  },
  {
    name: "Cristina Sierra",
    handle: "@cris_sierra17",
    tag: "Fundadora de Cristina Sierra Nail Experts: 10 sedes y más de un millón de seguidores. Una historia de resiliencia y superación.",
    talk: "Lo que no te rompe te hace imparable",
    subtitle: "La historia detrás de 10 sedes: resiliencia para levantarse de lo más duro.",
    photoUrl: PHOTO("cris"),
  },
  {
    name: "Alejandro Salinas",
    handle: "@salinas.beautybusiness",
    tag: "Asesor de negocios de belleza con 15 años en administración, finanzas y marketing. Te enseña a ordenar tu plata.",
    talk: "Ordena tu plata: precios, costos y cuánto te queda de verdad",
    subtitle: "Sal sabiendo cuánto cobrar, cuánto gastas y cuánto te queda, con herramientas sencillas que puedes usar desde mañana.",
    photoUrl: PHOTO("salinas"),
  },
  {
    name: "Karen",
    handle: "@karenw.trainer",
    tag: "Creadora del Método Esencia. Te ayuda a descubrir lo que te hace única y a convertirlo en tu sello.",
    talk: "Tu esencia es tu marca: deja de copiar y crea tu sello",
    subtitle: "Descubre lo que te hace única y conviértelo en una marca que tus clientas reconozcan y busquen.",
    photoUrl: "",
  },
  {
    name: "Fabi Pinillo Martínez",
    handle: "@fabiversatill",
    tag: "Nail artist y estratega de centros de belleza. Te enseña a llenar tu agenda: la técnica ya no es suficiente.",
    talk: "Agenda llena: estrategias y contenido que traen clientas",
    subtitle: "Del primer mensaje a la cita confirmada: qué publicar y cómo responder.",
    photoUrl: PHOTO("fabi"),
  },
  {
    name: "Juan Tenorio",
    handle: "@don.juantenorio",
    tag: "Asesor de negocios de belleza, con más de 500 salones y barberías transformados.",
    talk: "Clientas que vuelven: cómo hacer que te elijan, regresen y te recomienden",
    subtitle: "Servicio y experiencia para que cada clienta gaste más en cada visita.",
    photoUrl: PHOTO("juan"),
  },
  {
    name: "Oskar Garzón",
    handle: "@oskarivanquebelleza",
    tag: "Empresario y creador de marca. Cierra el congreso con visión, redes y la actitud para sobresalir.",
    talk: "Piensa en grande y hazte ver",
    subtitle: "Visión, redes y la actitud para sobresalir. Cierre del congreso y tu ruta final.",
    photoUrl: PHOTO("oskar"),
  },
];

// The panel's four guests (the team's update, 2026-10-26): Maria Carolina
// (Maris) is the one who started over from scratch; the other three aren't
// confirmed yet, so no one is made up — each of their cards shows a
// silhouette, «Por anunciar» and the story she brings (`story`, the card's
// line). Once one is confirmed, her name, Instagram, photo and line go here
// (or in the event's «Contenido») and her card shows them instead.
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
  {
    name: "Maria Carolina Sebastia Sandoval",
    handle: "@maris_nails_oficial",
    photoUrl: PHOTO("maris"),
    story: "De empezar desde nada a formar educadoras en toda Chile. En vivo desde Chile.",
  },
];
const PANEL_TONES = ["pink", "teal", "peach", "pink"] as const;

const session = (chip: string, fields: Partial<AgendaRow>): AgendaRow => ({ ...emptyAgendaRow("session"), chip, ...fields });
const day = (chip: string, topic: string, text: string, takeaway: string): AgendaRow => ({ ...emptyAgendaRow("day"), chip, topic, text, takeaway });
const pause = (chip: string) => session(chip, { topic: "Pausa activa" });
const speaker = (chip: string, name: string, label = "") => {
  const s = IMPARABLES_SPEAKERS.find((sp) => sp.name === name);
  return session(chip, { instructor: name, topic: s?.talk ?? "", text: s?.subtitle ?? "", photoUrl: s?.photoUrl ?? "", label });
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

  // Speakers, el panel y la maestra de ceremonias
  { type: "heading", eyebrow: "Speakers", title: "Las que te lo van a contar.", intro: "" },
  { type: "people", items: IMPARABLES_SPEAKERS.map(({ name, handle, tag, photoUrl }) => ({ name, handle, tag, photoUrl, tone: "pink" as const })) },
  {
    type: "card",
    eyebrow: "Panel · Domingo 27 · 10:25 a. m.",
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

  // La agenda: el domingo, las historias (de 9:00 a. m. a 1:45 p. m.); el
  // lunes, el plan en cinco pasos (de 9:00 a. m. a 2:00 p. m.)
  { type: "heading", eyebrow: "Agenda", title: "Así son los dos días", intro: "" },
  {
    type: "agenda",
    rows: [
      day(
        "Domingo 27 de junio",
        "Lo lograron con los mismos miedos que tú. Ahora te cuentan cómo.",
        "9:00 a. m. a 1:45 p. m.",
        "Cómo atravesaron las dificultades, tomaron riesgos y vencieron sus miedos para llegar donde están."
      ),
      withHost("9:00 a. m.", "Bienvenida", "Con Heidy Aristizábal, maestra de ceremonias"),
      speaker("9:15 a. m.", "Jimena Montalban"),
      pause("10:15 a. m."),
      session("10:25 a. m.", { topic: "Panel «El día que decidí cambiar»", text: "Cuatro historias reales de transformación" }),
      pause("11:10 a. m."),
      speaker("11:25 a. m.", "Paula Chacón"),
      pause("12:25 p. m."),
      speaker("12:35 p. m.", "Cristina Sierra"),
      // No raffle and no next edition's announcement (the team, 2026-10-26).
      withHost("1:35 p. m.", "Cierre del día", "Con Heidy Aristizábal"),
      day(
        "Lunes 28 de junio",
        "Ahora te toca a ti. Este es tu plan para lograrlo.",
        "9:00 a. m. a 2:00 p. m.",
        "Tus números, tu esencia, cómo atraer clientas y hacer que vuelvan: tu plan para ganar más y convertirte en la dueña de tu negocio."
      ),
      withHost("9:00 a. m.", "Repaso", "Con Heidy Aristizábal"),
      speaker("9:05 a. m.", "Alejandro Salinas", "Paso 1 · Tus números"),
      pause("9:55 a. m."),
      speaker("10:05 a. m.", "Karen", "Paso 2 · Tu esencia"),
      pause("10:55 a. m."),
      speaker("11:05 a. m.", "Fabi Pinillo Martínez", "Paso 3 · Atraer"),
      pause("11:55 a. m."),
      speaker("12:05 p. m.", "Juan Tenorio", "Paso 4 · Retener"),
      pause("12:55 p. m."),
      speaker("1:05 p. m.", "Oskar Garzón", "Paso 5 · Tu ruta"),
      withHost("1:35 p. m.", "Agradecimientos", "Con Heidy Aristizábal"),
    ],
  },

  // Los 3 resultados, en tarjetas que se deslizan: después de la agenda
  { type: "heading", eyebrow: "Resultados", title: "Lo que vas a resolver en estos dos días", intro: "" },
  {
    type: "slides",
    style: "results",
    items: [
      {
        tag: "Más clientas",
        title: "Llena tu agenda sin depender del voz a voz",
        text: "Contenido que atrae clientas, una marca con tu sello y clientas que vuelven y te recomiendan.",
        noteLabel: "Sales sabiendo",
        note: "qué publicar primero.",
        who: "Karen, Fabi Pinillo Martínez y Juan Tenorio",
        icon: "none",
      },
      {
        tag: "Más ganancia",
        title: "Cobra lo que vales, sin culpa",
        text: "Cuánto cobrar, cuánto ahorrar y cómo hablar de plata con tus clientas.",
        noteLabel: "Sales sabiendo",
        note: "cuánto debe dejarte cada servicio.",
        who: "Paula Chacón y Alejandro Salinas",
        icon: "none",
      },
      {
        tag: "Tu negocio",
        title: "De la mesa a dueña de tu marca",
        text: "Pasar de atender sola a tener salón, equipo o academia, y empezar de cero si te toca.",
        noteLabel: "Sales sabiendo",
        note: "cuál es tu primer paso.",
        who: "Jimena Montalban, Cristina Sierra y el panel",
        icon: "none",
      },
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
  // Hidden at the team's request (2026-10-26): kept in the editor, off the page.
  { type: "heading", eyebrow: "Para quién es", title: "¿Es para ti?", intro: "", hidden: true },
  {
    type: "card",
    eyebrow: "Es para ti si…",
    title: "",
    html:
      "<ul><li>Eres manicurista y quieres dejar de depender solo del voz a voz para conseguir clientas.</li><li>Ya tienes clientas, pero sientes que no cobras lo que vales.</li><li>Sueñas con tener tu propio salón, tu marca o tu academia.</li><li>Estás estudiando y quieres empezar con bases de negocio, no solo de técnica.</li></ul>",
    icon: "none",
    tone: "teal",
    imageUrl: "",
    hidden: true,
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
    hidden: true,
  },

  // Tu boleta: las etapas de precio salen de las entradas del evento
  { type: "heading", eyebrow: "Tu boleta", title: "Entre más temprano, menos pagas", intro: "" },
  { type: "prices", note: "" },
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
  { type: "heading", eyebrow: "", title: "¿Todavía lo estás pensando?", intro: "" },
  {
    type: "slides",
    style: "doubts",
    items: [
      {
        tag: "",
        title: "No tengo tiempo.",
        text: "Son dos mañanas, de 9:00 a. m. a 2:00 p. m., desde tu celular. Y si no puedes en vivo, tienes la repetición por 30 días.",
        noteLabel: "",
        note: "La repetición por 30 días viene con tu boleta.",
        who: "",
        icon: "clock",
      },
      {
        tag: "",
        title: "Apenas estoy empezando.",
        text: "Es de negocio, no de técnica: te sirve desde tu primera clienta.",
        noteLabel: "",
        note: "Paula empezó en una mesa de manicure y hoy es CEO de El Imperio de las Uñas.",
        who: "Paula Chacón",
        icon: "none",
      },
      {
        tag: "",
        title: "Mi caso es distinto.",
        text: "Hay caminos de todo tipo: independiente, salón, cadena, academia, y empezar de cero en otro país.",
        noteLabel: "",
        note: "Maria Carolina empezó desde nada y hoy forma educadoras en Chile; la escuchas en el panel.",
        who: "Maria Carolina Sebastia Sandoval",
        icon: "none",
      },
      {
        tag: "",
        title: "Ya hice cursos y no me sirvieron.",
        text: "Aquí no hay teoría: te cuentan cómo lo hicieron manicuristas que empezaron donde tú estás.",
        noteLabel: "",
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
          "Sí. Es 100% en vivo por Zoom, así que lo ves desde cualquier país. Las horas de la agenda están en hora Colombia. Si necesitas ayuda para pagar desde afuera, escríbenos por WhatsApp.",
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
  subtitle: "<p>Nadie nace imparable. <strong>Se hace.</strong></p><p>Tuvieron tus mismos miedos y hoy te cuentan cómo los atravesaron. Y tú sales con lo que a ellas les faltó al principio: qué te hace única, cuánto cobrar, estrategias para llenar tu agenda y cómo hacer que vuelvan.</p>",
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
