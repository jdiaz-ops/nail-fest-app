import { emptyAgendaRow, type AgendaRow, type LandingBlock } from "@/lib/landingBlocks/types";

// «Usar la plantilla de Manicuristas Imparables» (EventForm.tsx →
// /api/admin/events/[id]/plantilla-imparables, 2026-10-26): the page of the
// approved boceto, as ordinary blocks the team edits like any other event's —
// the hook, the 8 speakers, the panel, the host, the two days' program, what
// the ticket includes, who it is for, the prices with the guarantee, the
// questions and the sponsors (hidden until there are logos). Plus the
// event's own lines (tagline, closing, button) and its three price stages
// as ticket types. The panelists are made up, said so on the page itself,
// until the real ones are confirmed; the speakers' photos are their
// Instagram profile pictures (public/imparables/), to be replaced by better
// ones from the editor.

const PHOTO = (name: string) => `/imparables/${name}.jpg`;
const HOST = { name: "Heidy Aristizábal", photo: PHOTO("heidy") };

export const IMPARABLES_SPEAKERS = [
  { name: "Jimena", handle: "@jimenanails", tag: "De manicurista a empresaria con marca multinacional.", photoUrl: PHOTO("jimena") },
  { name: "Pau", handle: "@soypauc_tuprofe", tag: "De la mesa a más de 12 sedes: miedos, autosabotaje y cobrar sin culpa.", photoUrl: PHOTO("pau") },
  { name: "Juan Tenorio", handle: "@don.juantenorio", tag: "Precios y la plata del negocio.", photoUrl: PHOTO("juan") },
  { name: "Cris Sierra", handle: "@cris_sierra17", tag: "Una historia de superación: marca, cadena y academias.", photoUrl: PHOTO("cris") },
  { name: "Maris", handle: "@maris_nails_oficial", tag: "Empezar de cero en otro país. En vivo desde Chile.", photoUrl: PHOTO("maris") },
  { name: "Fabi", handle: "@fabiversatill", tag: "Estratega de salones: estrategias para hacer crecer el tuyo.", photoUrl: PHOTO("fabi") },
  { name: "Alejandro Salinas", handle: "@salinas.beautybusiness", tag: "Marketing con inteligencia artificial.", photoUrl: PHOTO("salinas") },
  { name: "Oskar", handle: "@oskarivanquebelleza", tag: "Energía, redes para sobresalir y la ruta final.", photoUrl: PHOTO("oskar") },
];

const session = (chip: string, fields: Partial<AgendaRow>): AgendaRow => ({ ...emptyAgendaRow("session"), chip, ...fields });
const day = (chip: string, topic: string, text: string): AgendaRow => ({ ...emptyAgendaRow("day"), chip, topic, text });
const pause = (chip: string) => session(chip, { topic: "Pausa activa" });
const speaker = (chip: string, name: string, topic: string) =>
  session(chip, { instructor: name, topic, photoUrl: IMPARABLES_SPEAKERS.find((s) => s.name === name)?.photoUrl ?? "" });
const withHost = (chip: string, topic: string, text: string) => session(chip, { topic, text, photoUrl: HOST.photo });

export const IMPARABLES_REFUND =
  "Sí, de dos formas. Si en los primeros 30 minutos del primer día sientes que el congreso no es para ti, escríbenos y te devolvemos el 100%, sin preguntas. Y dentro de los 5 días hábiles siguientes a tu compra también te devolvemos el 100%, siempre que el congreso no haya empezado. Fuera de eso no hacemos devoluciones, pero puedes pasarle tu boleta a otra persona escribiéndonos hasta el 25 de junio, y si no puedes verlo en vivo tienes la repetición por 30 días. Si Nail Fest cambia la fecha o cancela el congreso, tú eliges: te devolvemos todo o usas tu boleta en la nueva fecha. Para pedirlo, escríbenos por WhatsApp con el correo de tu compra; el dinero vuelve por el mismo medio de pago en máximo 30 días.";

export const IMPARABLES_BLOCKS: LandingBlock[] = [
  // El gancho
  {
    type: "heading",
    eyebrow: "Por qué ahora",
    title: "La técnica ya no es suficiente.",
    intro: "Haces uñas hermosas. Pero cobrar lo que vales, llenar tu agenda y hacer crecer tu negocio no te lo enseñó nadie.",
  },
  { type: "card", eyebrow: "Ellas empezaron donde tú estás hoy:", title: "en una mesa de manicure.", html: "", icon: "none", tone: "pink", imageUrl: "" },

  // Speakers, el panel y la maestra de ceremonias
  { type: "heading", eyebrow: "Speakers", title: "Ya lo lograron. Ahora te cuentan cómo.", intro: "" },
  { type: "people", items: IMPARABLES_SPEAKERS.map((s) => ({ ...s, tone: "pink" as const })) },
  {
    type: "card",
    eyebrow: "Panel · Lunes 28 · 12:05 p. m.",
    title: "Dinero sin tabú",
    html: "<p>Cuánto cobrar, cuánto ahorrar y cómo hablar de plata sin culpa.</p><p><em>Nombres de ejemplo · panelistas por confirmar</em></p>",
    icon: "none",
    tone: "pink",
    imageUrl: "",
  },
  {
    type: "people",
    items: [
      { name: "Valentina Ríos", handle: "", tag: "Dueña de tres salones en Medellín", photoUrl: "", tone: "pink" },
      { name: "Daniela Herrera", handle: "", tag: "Contadora de negocios de belleza", photoUrl: "", tone: "teal" },
      { name: "Carolina Méndez", handle: "", tag: "Manicurista independiente en Barranquilla", photoUrl: "", tone: "peach" },
      { name: "Natalia Gómez", handle: "", tag: "Asesora de finanzas para emprendedoras", photoUrl: "", tone: "pink" },
    ],
  },
  {
    type: "card",
    eyebrow: "Maestra de ceremonias",
    title: HOST.name,
    html: "<p>@hlacosedora</p><p>Creadora de Nail Fest, Guerra de Pinceles, Manicuristas Imparables y la marca H la Cosedora. Speaker e influencer.</p>",
    icon: "none",
    tone: "pink",
    imageUrl: HOST.photo,
  },

  // La agenda: todo cabe de 9:00 a. m. a 2:00 p. m.
  { type: "heading", eyebrow: "Agenda", title: "Dos días que cambian tu negocio", intro: "" },
  {
    type: "agenda",
    rows: [
      day("Domingo 27 de junio", "De la mesa a empresaria", "9:00 a. m. a 2:00 p. m."),
      withHost("9:00 a. m.", "Bienvenida", "Con Heidy Aristizábal, maestra de ceremonias"),
      speaker("9:15 a. m.", "Jimena", "De manicurista a empresaria"),
      pause("10:15 a. m."),
      speaker("10:25 a. m.", "Pau", "Miedos, autosabotaje y cobrar sin culpa"),
      pause("11:25 a. m."),
      speaker("11:40 a. m.", "Juan Tenorio", "Precios y la plata del negocio"),
      pause("12:40 p. m."),
      speaker("12:50 p. m.", "Cris Sierra", "Marca, cadena y academias"),
      withHost("1:50 p. m.", "Cierre y sorteo", "Con Heidy Aristizábal"),
      day("Lunes 28 de junio", "Sobresalir y pasar a la acción", "9:00 a. m. a 2:00 p. m."),
      withHost("9:00 a. m.", "Repaso", "Con Heidy Aristizábal"),
      speaker("9:05 a. m.", "Maris", "Empezar de cero en otro país"),
      pause("9:55 a. m."),
      speaker("10:05 a. m.", "Fabi", "Estrategias para hacer crecer tu salón"),
      pause("10:55 a. m."),
      speaker("11:05 a. m.", "Alejandro Salinas", "Marketing con inteligencia artificial"),
      pause("11:55 a. m."),
      session("12:05 p. m.", { topic: "Panel «Dinero sin tabú»", text: "Con Valentina, Daniela, Carolina y Natalia" }),
      pause("12:50 p. m."),
      speaker("1:00 p. m.", "Oskar", "Energía, redes y la ruta final"),
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
};

/** The three price stages, as ticket types (only for an event with none yet). Dates are Bogotá midnights. */
export const IMPARABLES_STAGES = [
  { name: "Preventa", price: 79_900, opensAt: "2027-02-27T00:00:00-05:00", closesAt: "2027-04-01T00:00:00-05:00" },
  { name: "General", price: 99_900, opensAt: "2027-04-01T00:00:00-05:00", closesAt: "2027-06-21T00:00:00-05:00" },
  { name: "Última semana", price: 119_900, opensAt: "2027-06-21T00:00:00-05:00", closesAt: "2027-06-27T00:00:00-05:00" },
];
/** Room in each stage: a cap that won't be the limit, to lower once Zoom's capacity is known. */
export const IMPARABLES_STAGE_QUANTITY = 3000;
