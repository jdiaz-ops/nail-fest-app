import type { SalesPageContent } from "./types";

// Structured content for Manicuristas Imparables' sales-script landing —
// copy pulled from the "guion-venta-maricuristas-imparables.pdf" the
// client provided (hook → story → stack de valor → cronograma → bios →
// para quién es → escasez → cierre → FAQ → P.D., same order the PDF
// itself insists on keeping).
//
// FABRICATED/PLACEHOLDER, per explicit instruction ("es un draft"): every
// testimonial quote+name+city, the full 2-day schedule (times/topics/
// speaker assignments) and each speaker's bio. The 4 speaker NAMES are
// real (Jimenails, Alesandro, Juan Tenorio, Cristina Sierra, as given by
// the client) — everything else about them here is invented and MUST be
// replaced with what they actually do/teach before this goes live. No
// `photoUrl` is set for any of them (SpeakerGrid.tsx falls back to an
// initials badge) — do not substitute a stock photo under a real person's
// name; add their real photoUrl once someone actually uploads one.
//
// Deliberately left OUT vs. the original PDF: the Early Bird/Regular/Full
// price-tier ladder and its countdown (the tiered-pricing build,
// explicitly deferred — "no haga el 2 aún"; `priceToday` below is the
// PDF's own single "precio de hoy" case) and the Addi installment-payment
// mention (Wompi is the only payment method actually wired up so far —
// see docs/PAYMENTS_SETUP.md). Add both back once those exist.
export const manicuristasImparablesSalesPage: SalesPageContent = {
  hero: {
    eyebrow: "Congreso virtual Nail Fest · 27 y 28 de junio de 2027",
    headline: "De manicurista que espera clientas a dueña de un negocio que las atrae",
    subheadline:
      "2 días en vivo, 100% virtuales, donde vas a construir en tiempo real la manicurista profesional que ya eres capaz de ser — con las herramientas que hoy te faltan.",
    tensionLine: "Sabes hacer uñas increíbles. Pero llenar tu agenda, cobrar lo que vales y hacer crecer tu negocio sola — eso nadie te lo enseñó.",
  },
  story: {
    intro:
      "Nail Fest ha reunido a miles de manicuristas y estudiantes en todo Colombia. Ahora llevamos esa misma comunidad a un congreso virtual de 2 días, con expertas de la industria — para que salgas con algo concreto en la mano, no solo con apuntes.",
    testimonials: [
      {
        quote: "Después de una feria de Nail Fest monté mi primera pauta en redes y en un mes dupliqué mis citas.",
        name: "Valentina R.",
        city: "Bogotá",
      },
      {
        quote: "Aprendí a cobrar lo que valía mi trabajo. Dejé de regalar mi tiempo.",
        name: "Carolina M.",
        city: "Medellín",
      },
    ],
    transition:
      "Vas a salir de estos 2 días con algo que hoy no tienes: tu primera pauta en Meta corriendo, tu cuadernillo lleno de un plan de acción, y una comunidad que te empuja a ejecutarlo.",
  },
  valueStack: {
    items: [
      { label: "Entrada en vivo a los 2 días del congreso", value: 150000 },
      { label: "Cuadernillo de seguimiento", detail: "notas + ejercicios de cada speaker", value: 40000 },
      { label: "Plantillas digitales", detail: "precios, redes, presupuesto", value: 60000 },
      { label: "Plantilla de consentimiento/contrato", detail: "para tus clientas", value: 30000 },
      { label: "Slides descargables", detail: "de cada speaker", value: 50000 },
      { label: "Grabaciones de las charlas", detail: "30 días de acceso", value: 80000 },
      { label: "Certificado digital de asistencia", detail: "con tu nombre", value: 20000 },
    ],
    totalValue: 430000,
    priceToday: 80000,
  },
  schedule: {
    timezoneNote: "Horarios en hora Colombia. El cronograma final con la duración exacta de cada bloque se confirma antes del evento.",
    days: [
      {
        label: "Día 1 — domingo 27 de junio",
        blocks: [
          { time: "10:00 a.m.", topic: "De manicurista a marca: cómo construir tu identidad en redes", speaker: "Jimenails" },
          { time: "12:00 p.m.", topic: "Cobra lo que vales: pricing sin miedo", speaker: "Alesandro" },
          { time: "2:00 p.m.", topic: "Cómo crear tu primera pauta en Meta (en vivo)", speaker: "Juan Tenorio" },
        ],
      },
      {
        label: "Día 2 — lunes 28 de junio",
        blocks: [
          { time: "10:00 a.m.", topic: "Clientas que vuelven: experiencia y fidelización", speaker: "Cristina Sierra" },
          { time: "12:00 p.m.", topic: "Preguntas en vivo con todo el panel de expertas", speaker: "Panel completo" },
          { time: "2:00 p.m.", topic: "Cierre + plan de acción del reto post-evento", speaker: "Equipo Nail Fest" },
        ],
      },
    ],
  },
  speakers: [
    {
      name: "Jimenails",
      role: "Nail artist y educadora",
      bio: "Con años construyendo su marca personal desde el nail art y las redes sociales. En este congreso te enseña a convertir tu trabajo en una identidad que atrae clientas solas.",
    },
    {
      name: "Alesandro",
      role: "Especialista en pricing y estrategia de negocio",
      bio: "Ayuda a manicuristas a poner precios que reflejen su trabajo real, sin miedo a \"perder\" clientas. En este congreso te enseña a construir tu propia tabla de precios.",
    },
    {
      name: "Juan Tenorio",
      role: "Especialista en pauta digital y crecimiento en Meta",
      bio: "Te lleva paso a paso, desde cero, a crear tu primera campaña publicitaria en vivo durante el congreso — sin experiencia previa en Meta Ads.",
    },
    {
      name: "Cristina Sierra",
      role: "Manicurista y experta en experiencia de cliente",
      bio: "Te enseña cómo lograr que una clienta que te visita una vez, vuelva siempre — el trabajo que pasa después de la cita.",
    },
  ],
  forWhom: {
    yes: [
      "Eres manicurista y quieres dejar de depender solo del voz a voz para conseguir clientas.",
      "Eres estudiante y quieres aprender de expertas antes de abrir tu propio negocio.",
      "Ya tienes clientas, pero sientes que no cobras lo que vales.",
      "Quieres aprender a hacer tu propia pauta digital sin pagarle a una agencia.",
    ],
    no: [
      "Buscas una fórmula mágica sin poner en práctica nada de lo que aprendas.",
      "No tienes intención de atender clientas de uñas ni de crecer un negocio en esta industria.",
    ],
  },
  urgency: {
    capacity: 1000,
    note: "Cupos limitados a 1.000 personas en simultáneo. Cuando se acaban, se acaban — no hay reposición ni segunda tanda.",
  },
  guarantee: {
    title: "Garantía sin preguntas",
    text: "Si en los primeros 30 minutos del Día 1 sientes que esto no es para ti, escríbenos y te devolvemos tu dinero. Sin preguntas.",
  },
  faq: [
    {
      question: "¿Y si no puedo estar en vivo los dos días?",
      answer: "No hay problema. Tienes acceso a las grabaciones durante 30 días para verlas cuando puedas.",
    },
    {
      question: "¿Sirve si soy estudiante y aún no tengo mi propio negocio?",
      answer: "Sí. El contenido está pensado tanto para quien ya tiene clientas como para quien se está preparando para empezar.",
    },
    {
      question: "¿Necesito experiencia previa en pauta digital o en Meta Ads?",
      answer: "No. La clase de pauta en Meta parte desde cero y te lleva paso a paso a crear tu primera campaña en vivo.",
    },
    {
      question: "¿Cómo recibo mi acceso al evento?",
      answer:
        "Después de tu registro, recibes por correo y WhatsApp tu confirmación. El link único de acceso a las sesiones en Zoom te llega más cerca de la fecha del evento.",
    },
    {
      question: "¿Hay devolución si no me gusta?",
      answer: "Sí, dentro de los primeros 30 minutos del Día 1 puedes solicitar el reembolso completo.",
    },
  ],
  closingPs:
    "Si llegaste hasta aquí sin leer todo: por $80.000 recibes 2 días en vivo con expertas de la industria, tu cuadernillo de trabajo, plantillas listas para usar, grabaciones por 30 días y tu certificado — con garantía de devolución en los primeros 30 minutos si sientes que no es para ti. Los cupos son limitados a 1.000 personas. Asegura el tuyo ahora.",
};
