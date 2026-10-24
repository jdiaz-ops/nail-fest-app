import { SAMPLE_SLUG_PREFIX, type InstructorCard, type InstructorClassItem, type LibraryLevel, type LibraryTheme, type LibraryVideoCard, type UsedProduct } from "./shared";

// Invented examples, for staff only (asked on 2026-10-24: "ponle videos y
// demás muestras inventados por ahora mientras se va poblando"). They fill
// the sections that don't have enough real content yet, carry an
// "Ejemplo" badge, have no YouTube video, no store links and no real
// people: "Instructora A" and "Marca A" never pass for someone real. The
// public never sees them — same rule as the cuponera's examples.

interface SampleInstructor {
  key: string;
  name: string;
  city: string;
  specialties: string[];
  bio: string;
  featured: boolean;
  appearances: string[];
  tone: number;
}

const INSTRUCTORS: SampleInstructor[] = [
  {
    key: "a",
    name: "Instructora A",
    city: "Cúcuta",
    specialties: ["Polygel", "Nail art", "Francesa"],
    bio: "Educadora de uñas desde 2018. Enseño polygel y nail art a manicuristas que están empezando. Mi consejo: menos producto y más paciencia.",
    featured: true,
    appearances: ["Nail Fest Cúcuta 2026 · Tarima principal", "Maratón de técnicas · En línea"],
    tone: 1,
  },
  {
    key: "b",
    name: "Instructora B",
    city: "Bogotá",
    specialties: ["Manicura rusa"],
    bio: "Me especializo en manicura rusa y en el cuidado de la cutícula. Trabajo con salones de Bogotá.",
    featured: false,
    appearances: ["Maratón de técnicas · En línea"],
    tone: 2,
  },
  {
    key: "c",
    name: "Instructora C",
    city: "Medellín",
    specialties: ["Acrílico", "Esculpidas"],
    bio: "Esculpo uñas en acrílico desde hace diez años y enseño a hacerlo sin dañar la uña natural.",
    featured: false,
    appearances: [],
    tone: 3,
  },
  {
    key: "d",
    name: "Instructora D",
    city: "Cali",
    specialties: ["Bioseguridad"],
    bio: "Enfermera y manicurista. Enseño bioseguridad para que tu puesto sea un lugar seguro para ti y tus clientas.",
    featured: true,
    appearances: ["Nail Fest Cúcuta 2026 · Charla de bioseguridad"],
    tone: 4,
  },
  {
    key: "e",
    name: "Instructora E",
    city: "Bucaramanga",
    specialties: ["Semipermanente"],
    bio: "Semipermanente que dura tres semanas: preparación, capas finas y buen curado.",
    featured: false,
    appearances: [],
    tone: 5,
  },
  {
    key: "f",
    name: "Instructora F",
    city: "Barranquilla",
    specialties: ["Nail art"],
    bio: "Diseños a mano alzada para cada temporada del año.",
    featured: false,
    appearances: [],
    tone: 6,
  },
  {
    key: "g",
    name: "Instructora G",
    city: "Cúcuta",
    specialties: ["Pedicura", "Spa"],
    bio: "Pedicura spa y cuidado del pie, paso a paso.",
    featured: false,
    appearances: [],
    tone: 7,
  },
  {
    key: "h",
    name: "Instructora H",
    city: "Bogotá",
    specialties: ["Negocio"],
    bio: "Te ayudo a ponerle precio a tu trabajo y a llenar tu agenda.",
    featured: false,
    appearances: ["Nail Fest Cúcuta 2026 · Charla de negocio"],
    tone: 8,
  },
];

const instructorSlug = (key: string) => `${SAMPLE_SLUG_PREFIX}instructora-${key}`;

function person(key: string) {
  const i = INSTRUCTORS.find((x) => x.key === key)!;
  return { slug: instructorSlug(i.key), name: i.name, initial: i.key.toUpperCase(), city: i.city, photoUrl: null, tone: i.tone, featured: i.featured };
}

interface SampleVideo {
  key: string;
  kind: "video" | "maraton";
  title: string;
  theme: LibraryTheme;
  level: LibraryLevel;
  instructor: string | null;
  teachersNote?: string;
  seconds: number;
  views: number;
  weekViews: number;
  daysAgo: number;
  description: string;
  products: string[];
  steps: string[];
}

const VIDEOS: SampleVideo[] = [
  {
    key: "errores-polygel",
    kind: "video",
    title: "3 errores que levantan el polygel",
    theme: "errores",
    level: "principiante",
    instructor: "a",
    seconds: 52,
    views: 21400,
    weekViews: 5200,
    daysAgo: 6,
    description: "Por qué se levanta el polygel en los primeros días y cómo evitarlo desde la preparación.",
    products: ["polygel", "deshidratador", "top"],
    steps: ["Retira el brillo de la uña natural con un buffer suave.", "Deshidrata y aplica el primer solo donde va el producto.", "Trabaja el polygel en capas finas, sin tocar la cutícula.", "Cura cada capa el tiempo completo de tu lámpara."],
  },
  {
    key: "retiro-acrilico",
    kind: "video",
    title: "Retiro de acrílico sin dañar la uña",
    theme: "tecnicas",
    level: "principiante",
    instructor: "c",
    seconds: 45,
    views: 15300,
    weekViews: 4100,
    daysAgo: 9,
    description: "Retira el acrílico con torno y remojo, cuidando la uña natural.",
    products: ["torno", "aceite"],
    steps: ["Rebaja el grosor del acrílico con el torno a baja velocidad.", "Remoja con removedor y envuelve cada uña.", "Retira los restos con un empujador, sin forzar.", "Hidrata la cutícula con aceite al final."],
  },
  {
    key: "precio-servicio",
    kind: "video",
    title: "Cómo calcular el precio de un servicio",
    theme: "negocio",
    level: "principiante",
    instructor: "h",
    seconds: 58,
    views: 11200,
    weekViews: 3600,
    daysAgo: 4,
    description: "Materiales, tiempo y ganancia: la cuenta para no cobrar de menos.",
    products: [],
    steps: ["Suma lo que gastas en materiales por servicio.", "Calcula cuánto vale una hora de tu trabajo.", "Agrega los gastos fijos del mes repartidos por servicio.", "Súmale tu ganancia y compara con tu zona."],
  },
  {
    key: "esterilizar-herramientas",
    kind: "video",
    title: "Esteriliza tus herramientas en 5 pasos",
    theme: "bioseguridad",
    level: "principiante",
    instructor: "d",
    seconds: 40,
    views: 9100,
    weekViews: 2900,
    daysAgo: 12,
    description: "Lavar, desinfectar y esterilizar no son lo mismo. Aquí, el orden correcto.",
    products: ["guantes"],
    steps: ["Lava las herramientas con agua y jabón.", "Sécalas por completo.", "Desinféctalas con el producto indicado.", "Esterilízalas según el equipo que tengas.", "Guárdalas cerradas hasta el siguiente servicio."],
  },
  {
    key: "francesa-invertida",
    kind: "video",
    title: "Francesa invertida con cromo",
    theme: "tecnicas",
    level: "intermedio",
    instructor: "a",
    seconds: 48,
    views: 8300,
    weekViews: 2100,
    daysAgo: 2,
    description: "Una francesa con la línea junto a la cutícula, terminada en cromo. Consejo: dibuja la línea con un pincel fino antes de rellenar.",
    products: ["gel-rosa", "pincel", "top"],
    steps: ["Prepara la uña y aplica la base.", "Dibuja la línea junto a la cutícula con un pincel fino.", "Rellena el resto de la uña y cura.", "Aplica el cromo sobre el top y sella."],
  },
  {
    key: "amor-y-amistad",
    kind: "video",
    title: "Diseños para Amor y Amistad",
    theme: "tendencias",
    level: "intermedio",
    instructor: "f",
    seconds: 36,
    views: 7100,
    weekViews: 1800,
    daysAgo: 15,
    description: "Tres diseños rápidos para la temporada que más se pide en septiembre.",
    products: ["gel-rosa", "pincel"],
    steps: ["Elige una base nude.", "Pinta los corazones con un punteador.", "Delinea con el pincel liner.", "Sella con top."],
  },
  {
    key: "extension-polygel",
    kind: "video",
    title: "Extensión con polygel paso a paso",
    theme: "tecnicas",
    level: "intermedio",
    instructor: "c",
    seconds: 58,
    views: 6400,
    weekViews: 900,
    daysAgo: 20,
    description: "La extensión completa con moldes duales, de la preparación al limado final.",
    products: ["polygel", "lampara"],
    steps: ["Prepara la uña natural.", "Llena el molde dual con la cantidad justa.", "Presiónalo sobre la uña y cura.", "Retira el molde y lima la forma."],
  },
  {
    key: "cuando-usar",
    kind: "video",
    title: "Gel, acrílico o polygel: cuándo usar cada uno",
    theme: "productos",
    level: "principiante",
    instructor: "a",
    seconds: 57,
    views: 5900,
    weekViews: 700,
    daysAgo: 25,
    description: "Las diferencias que importan para elegir el producto según la clienta.",
    products: ["polygel", "kit-acrilico"],
    steps: [],
  },
  {
    key: "manicura-rusa",
    kind: "video",
    title: "Manicura rusa: la cutícula perfecta",
    theme: "tecnicas",
    level: "avanzado",
    instructor: "b",
    seconds: 55,
    views: 4800,
    weekViews: 600,
    daysAgo: 30,
    description: "Fresas, velocidad y ángulo para una cutícula limpia sin cortes.",
    products: ["torno", "aceite"],
    steps: ["Elige la fresa de llama para la cutícula.", "Trabaja a baja velocidad con la fresa casi plana.", "Limpia los pellejos sin presionar.", "Termina con aceite."],
  },
  {
    key: "unas-mordidas",
    kind: "video",
    title: "De uñas mordidas a uñas sanas",
    theme: "transformaciones",
    level: "principiante",
    instructor: "e",
    seconds: 42,
    views: 4100,
    weekViews: 500,
    daysAgo: 33,
    description: "Una clienta, tres citas: así cambian las uñas mordidas con rubber base.",
    products: ["rubber"],
    steps: [],
  },
  {
    key: "primer-salon",
    kind: "video",
    title: "Mi primer salón: lo que nadie me dijo",
    theme: "personas",
    level: "principiante",
    instructor: "h",
    seconds: 59,
    views: 3600,
    weekViews: 400,
    daysAgo: 38,
    description: "Lo que aprendí al abrir mi primer salón, para que no te pase.",
    products: [],
    steps: [],
  },
  {
    key: "pedicura-spa",
    kind: "video",
    title: "Pedicura spa en 10 pasos",
    theme: "tecnicas",
    level: "intermedio",
    instructor: "g",
    seconds: 50,
    views: 2900,
    weekViews: 300,
    daysAgo: 41,
    description: "La pedicura spa completa, del remojo al masaje.",
    products: ["aceite", "guantes"],
    steps: ["Remoja los pies en agua tibia.", "Exfolia y retira la piel muerta.", "Corta y lima las uñas.", "Hidrata y masajea."],
  },
  {
    key: "maraton-polygel",
    kind: "maraton",
    title: "Maratón de polygel",
    theme: "tecnicas",
    level: "intermedio",
    instructor: null,
    teachersNote: "4 instructoras",
    seconds: 3 * 3600,
    views: 3200,
    weekViews: 0,
    daysAgo: 18,
    description: "La grabación completa de la maratón: preparación, extensión, diseño y retiro de polygel.",
    products: ["polygel", "lampara", "top"],
    steps: [],
  },
  {
    key: "maraton-navidad",
    kind: "maraton",
    title: "Maratón de nail art navideño",
    theme: "tendencias",
    level: "intermedio",
    instructor: null,
    teachersNote: "3 instructoras",
    seconds: 2 * 3600,
    views: 2100,
    weekViews: 0,
    daysAgo: 28,
    description: "Diseños de temporada para diciembre, de lo más rápido a lo más elaborado.",
    products: ["gel-rosa", "pincel"],
    steps: [],
  },
  {
    key: "maraton-negocio",
    kind: "maraton",
    title: "Negocio de uñas: precios y clientas",
    theme: "negocio",
    level: "principiante",
    instructor: null,
    teachersNote: "3 instructoras",
    seconds: 2 * 3600,
    views: 1700,
    weekViews: 0,
    daysAgo: 45,
    description: "Cómo cobrar, cómo conseguir clientas y cómo hacer que vuelvan.",
    products: [],
    steps: [],
  },
];

// "Lo que usó" for the examples: invented brands and products with the
// look of the cuponera's own examples, the code shown but no store.
const PRODUCTS: Record<string, Omit<UsedProduct, "key" | "imageUrl" | "url" | "code">> = {
  polygel: { brand: "Marca A", name: "Polygel rosa nude 30 g", icon: "bottle", color: "#f6e3d8", tint: "#fff3ea", discountPercent: 10 },
  deshidratador: { brand: "Marca B", name: "Deshidratador y primer", icon: "drop", color: "#c4efeb", tint: "#e6f9f7", discountPercent: 15 },
  top: { brand: "Marca A", name: "Top coat sin limpieza 15 ml", icon: "bottle", color: "#ffffff", tint: "#f3f1ee", discountPercent: 10 },
  torno: { brand: "Marca F", name: "Torno eléctrico profesional", icon: "drill", color: "#ffc5a8", tint: "#fff3ea", discountPercent: 15 },
  aceite: { brand: "Marca E", name: "Aceite de cutícula de almendras", icon: "drop", color: "#f2b01e", tint: "#fdf3d6", discountPercent: 15 },
  guantes: { brand: "Marca E", name: "Guantes de nitrilo x100", icon: "kit", color: "#c4efeb", tint: "#e6f9f7", discountPercent: 10 },
  "gel-rosa": { brand: "Marca A", name: "Gel semipermanente Rosa chicle", icon: "bottle", color: "#f48fb1", tint: "#fde8ef", discountPercent: 15 },
  pincel: { brand: "Marca B", name: "Pincel liner 00 para nail art", icon: "brush", color: "#17181c", tint: "#e6f9f7", discountPercent: 15 },
  lampara: { brand: "Marca C", name: "Lámpara LED/UV 36 W", icon: "lamp", color: "none", tint: "#f3f1ee", discountPercent: 15 },
  "kit-acrilico": { brand: "Marca C", name: "Kit de acrílico para empezar", icon: "kit", color: "#ffc5a8", tint: "#fff3ea", discountPercent: 20 },
  rubber: { brand: "Marca B", name: "Base rubber nivelante 15 ml", icon: "bottle", color: "#f6e3d8", tint: "#fff3ea", discountPercent: 15 },
};

const SAMPLE_CODE = "NAILFEST";
const DAY_MS = 86_400_000;

export function sampleVideoSlug(key: string): string {
  return `${SAMPLE_SLUG_PREFIX}${key}`;
}

function toCard(v: SampleVideo, now: Date): LibraryVideoCard {
  return {
    id: `sample-${v.key}`,
    slug: sampleVideoSlug(v.key),
    kind: v.kind,
    title: v.title,
    description: v.description,
    theme: v.theme,
    level: v.level,
    youtubeId: null,
    durationSeconds: v.seconds,
    instructor: v.instructor ? person(v.instructor) : null,
    teachersNote: v.teachersNote ?? null,
    gated: v.kind === "maraton",
    publishedAt: new Date(now.getTime() - v.daysAgo * DAY_MS).toISOString(),
    views: v.views,
    weekViews: v.weekViews,
    sample: true,
  };
}

/** Every example video and recording, newest first. */
export function sampleVideos(now: Date = new Date()): LibraryVideoCard[] {
  return [...VIDEOS].sort((a, b) => a.daysAgo - b.daysAgo).map((v) => toCard(v, now));
}

export interface SampleVideoDetail {
  card: LibraryVideoCard;
  products: UsedProduct[];
  steps: string[];
}

export function sampleVideoDetail(slug: string, now: Date = new Date()): SampleVideoDetail | null {
  const video = VIDEOS.find((v) => sampleVideoSlug(v.key) === slug);
  if (!video) return null;
  return {
    card: toCard(video, now),
    products: video.products.map((key) => ({ key: `sample-${key}`, ...PRODUCTS[key]!, imageUrl: null, code: SAMPLE_CODE, url: null })),
    steps: video.steps,
  };
}

function sampleClasses(key: string, now: Date): InstructorClassItem[] {
  const at = (days: number, hour: number) => {
    // 7:00 p. m. Bogotá = 00:00 UTC of the next day.
    const day = new Date(now.getTime() + days * DAY_MS);
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour + 5)).toISOString();
  };
  const all: Record<string, InstructorClassItem[]> = {
    a: [
      { id: "sample-class-a1", title: "Maratón de polygel", startsAt: at(19, 19), place: "En línea por Zoom", priceLabel: "Gratis con registro", url: null },
      { id: "sample-class-a2", title: "Taller de nail art", startsAt: at(37, 10), place: "Presencial en Cúcuta", priceLabel: "Cupos limitados", url: null },
    ],
    d: [{ id: "sample-class-d1", title: "Bioseguridad para tu puesto", startsAt: at(26, 19), place: "En línea por Zoom", priceLabel: "Gratis", url: null }],
  };
  return all[key] ?? [];
}

export function sampleInstructors(now: Date = new Date()): InstructorCard[] {
  const videos = sampleVideos(now);
  return INSTRUCTORS.map((i) => {
    const slug = instructorSlug(i.key);
    return {
      id: `sample-${i.key}`,
      slug,
      name: i.name,
      initial: i.key.toUpperCase(),
      city: i.city,
      photoUrl: null,
      tone: i.tone,
      featured: i.featured,
      bio: i.bio,
      specialties: i.specialties,
      instagram: `instructora.${i.key}`,
      tiktok: `instructora.${i.key}`,
      appearances: i.appearances,
      videoCount: videos.filter((v) => v.instructor?.slug === slug).length,
      nextClass: sampleClasses(i.key, now)[0] ?? null,
      sample: true,
    };
  });
}

export function sampleInstructorClasses(slug: string, now: Date = new Date()): InstructorClassItem[] {
  const key = INSTRUCTORS.find((i) => instructorSlug(i.key) === slug)?.key;
  return key ? sampleClasses(key, now) : [];
}
