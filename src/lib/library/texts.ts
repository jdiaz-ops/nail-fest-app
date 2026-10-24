// Every text and section of the library and the instructors' pages that
// the admin can change or switch off (Editar biblioteca → Textos y
// secciones), with the usual text — what shows while the admin leaves it
// empty. No database here: the admin's form imports it too.

export type LibraryPage = "biblioteca" | "video" | "instructoras" | "perfil" | "formularios";

export const LIBRARY_PAGES: { key: LibraryPage; label: string; hint: string }[] = [
  { key: "biblioteca", label: "Portada de la biblioteca", hint: "nailfest.lat/biblioteca" },
  { key: "video", label: "Página de cada video", hint: "nailfest.lat/biblioteca/<video>" },
  { key: "instructoras", label: "Directorio de instructoras", hint: "nailfest.lat/instructoras" },
  { key: "perfil", label: "Perfil de cada instructora", hint: "nailfest.lat/instructoras/<instructora>" },
  { key: "formularios", label: "Formularios", hint: "Registro gratis, postulación, marcas y clases" },
];

interface TextDef {
  page: LibraryPage;
  label: string;
  value: string;
  /** Long texts get a box instead of a line. */
  long?: boolean;
  /** The section it belongs to: shown under that section's switch. */
  section?: LibrarySectionKey;
}

export const LIBRARY_SECTIONS = {
  themes: { page: "biblioteca", label: "Explora por tema", hint: "Los ocho temas, con cuántos videos tiene cada uno." },
  levels: { page: "biblioteca", label: "Filtro por nivel", hint: "Principiante, intermedio y avanzado, debajo de los temas." },
  newest: { page: "biblioteca", label: "Lo nuevo", hint: "Los últimos videos publicados." },
  mostViewed: { page: "biblioteca", label: "Lo más visto esta semana", hint: "Sale cuando al menos 3 videos tienen visitas en los últimos 7 días." },
  recordings: { page: "biblioteca", label: "Grabaciones de maratones", hint: "Las grabaciones largas, con su candado de registro gratis." },
  signup: { page: "biblioteca", label: "Registro gratis", hint: "El recuadro que invita a registrarse." },
  instructorsRow: { page: "biblioteca", label: "Aprende con", hint: "Las instructoras, con enlace a su perfil." },
  used: { page: "video", label: "Lo que usó", hint: "Los productos del video, con el descuento y el código de la cuponera." },
  steps: { page: "video", label: "El paso a paso", hint: "Los pasos del video, que se ven con el registro gratis." },
  related: { page: "video", label: "Sigue con", hint: "Más videos del mismo tema." },
  filters: { page: "instructoras", label: "Filtros", hint: "Ciudad y especialidad, arriba de las tarjetas." },
  teachCta: { page: "instructoras", label: "¿Enseñas uñas?", hint: "La invitación a postularse." },
  brandCta: { page: "instructoras", label: "¿Tienes una marca?", hint: "La invitación a las marcas que buscan instructoras." },
  profileVideos: { page: "perfil", label: "Sus videos", hint: "Los videos de la instructora en la biblioteca." },
  classes: { page: "perfil", label: "Próximas clases", hint: "Las clases que tiene programadas." },
  profileProducts: { page: "perfil", label: "Lo que usa en sus videos", hint: "Las marcas de la cuponera que salen en sus videos." },
  appearances: { page: "perfil", label: "Ha estado en", hint: "Los eventos de Nail Fest en los que ha estado." },
  hire: { page: "perfil", label: "¿Tu marca necesita una instructora?", hint: "El recuadro final para las marcas." },
} as const satisfies Record<string, { page: LibraryPage; label: string; hint: string }>;

export type LibrarySectionKey = keyof typeof LIBRARY_SECTIONS;

export const LIBRARY_SECTION_KEYS = Object.keys(LIBRARY_SECTIONS) as LibrarySectionKey[];

export const LIBRARY_TEXTS = {
  homeTitle: { page: "biblioteca", label: "Título", value: "Biblioteca Nail Fest" },
  homeLede: { page: "biblioteca", label: "Texto debajo del título", value: "Técnicas, negocio y bioseguridad, explicadas por instructoras Nail Fest. Gratis.", long: true },
  searchPlaceholder: { page: "biblioteca", label: "Texto dentro del buscador", value: "Busca una técnica o un producto" },
  themesTitle: { page: "biblioteca", label: "Título", value: "Explora por tema", section: "themes" },
  newestTitle: { page: "biblioteca", label: "Título", value: "Lo nuevo", section: "newest" },
  mostViewedTitle: { page: "biblioteca", label: "Título", value: "Lo más visto esta semana", section: "mostViewed" },
  recordingsTitle: { page: "biblioteca", label: "Título", value: "Grabaciones de maratones", section: "recordings" },
  lockedLabel: { page: "biblioteca", label: "Candado de las grabaciones", value: "Gratis con registro", section: "recordings" },
  signupTitle: { page: "biblioteca", label: "Título", value: "Regístrate gratis", section: "signup" },
  signupText: { page: "biblioteca", label: "Texto", value: "Ve las grabaciones completas de las maratones y el paso a paso de cada técnica.", long: true, section: "signup" },
  signupButton: { page: "biblioteca", label: "Botón", value: "Registrarme", section: "signup" },
  instructorsRowTitle: { page: "biblioteca", label: "Título", value: "Aprende con", section: "instructorsRow" },
  emptyText: { page: "biblioteca", label: "Mientras no haya videos", value: "Muy pronto: estamos preparando los primeros videos con las instructoras Nail Fest.", long: true },

  usedTitle: { page: "video", label: "Título", value: "Lo que usó", section: "used" },
  usedSubtitle: { page: "video", label: "Texto debajo", value: "Con descuento en la Cuponera Nail Fest.", section: "used" },
  buyButton: { page: "video", label: "Botón de cada producto", value: "Comprar", section: "used" },
  stepsTitle: { page: "video", label: "Título", value: "El paso a paso", section: "steps" },
  stepsLockedText: { page: "video", label: "Texto antes del registro", value: "Los pasos de esta técnica, uno por uno. Gratis con tu registro.", long: true, section: "steps" },
  stepsButton: { page: "video", label: "Botón", value: "Ver el paso a paso", section: "steps" },
  relatedTitle: { page: "video", label: "Título", value: "Sigue con", section: "related" },

  directoryTitle: { page: "instructoras", label: "Título", value: "Instructoras Nail Fest" },
  directoryLede: {
    page: "instructoras",
    label: "Texto debajo del título",
    value: "Educadoras de uñas elegidas por Nail Fest. Mira sus técnicas, encuentra sus clases y contáctalas desde aquí.",
    long: true,
  },
  directorySearchPlaceholder: { page: "instructoras", label: "Texto dentro del buscador", value: "Busca por nombre, ciudad o técnica" },
  teachTitle: { page: "instructoras", label: "Título", value: "¿Enseñas uñas?", section: "teachCta" },
  teachText: {
    page: "instructoras",
    label: "Texto",
    value: "Postúlate para ser Instructora Nail Fest: tus videos en nuestras redes y en nuestro correo, tu perfil aquí y espacio en nuestras clases y eventos.",
    long: true,
    section: "teachCta",
  },
  teachButton: { page: "instructoras", label: "Botón", value: "Postularme", section: "teachCta" },
  brandTitle: { page: "instructoras", label: "Título", value: "¿Tienes una marca?", section: "brandCta" },
  brandText: {
    page: "instructoras",
    label: "Texto",
    value: "Te conectamos con instructoras para lanzamientos, demostraciones y capacitaciones, en la ciudad que necesites.",
    long: true,
    section: "brandCta",
  },
  brandButton: { page: "instructoras", label: "Botón", value: "Buscar instructoras", section: "brandCta" },
  directoryEmptyText: { page: "instructoras", label: "Mientras no haya instructoras", value: "Muy pronto: estamos eligiendo a las primeras Instructoras Nail Fest.", long: true },

  sealLabel: { page: "perfil", label: "Sello", value: "Instructora invitada Nail Fest" },
  featuredLabel: { page: "perfil", label: "Sello de las destacadas", value: "Destacada" },
  bookButton: { page: "perfil", label: "Botón para reservar", value: "Reservar clase" },
  hireButton: { page: "perfil", label: "Botón para marcas", value: "Contratar para tu marca" },
  profileVideosTitle: { page: "perfil", label: "Título", value: "Sus videos", section: "profileVideos" },
  classesTitle: { page: "perfil", label: "Título", value: "Próximas clases", section: "classes" },
  profileProductsTitle: { page: "perfil", label: "Título", value: "Lo que usa en sus videos", section: "profileProducts" },
  appearancesTitle: { page: "perfil", label: "Título", value: "Ha estado en", section: "appearances" },
  hireTitle: { page: "perfil", label: "Título", value: "¿Tu marca necesita una instructora?", section: "hire" },
  hireText: {
    page: "perfil",
    label: "Texto",
    value: "Para un lanzamiento, una demostración o una capacitación. Escríbenos y te conectamos con ella.",
    long: true,
    section: "hire",
  },

  signupFormTitle: { page: "formularios", label: "Registro gratis: título", value: "Regístrate gratis" },
  signupFormText: {
    page: "formularios",
    label: "Registro gratis: texto",
    value: "Con tu registro ves las grabaciones de las maratones y el paso a paso de cada técnica.",
    long: true,
  },
  applyFormTitle: { page: "formularios", label: "Postulación: título", value: "Postúlate como Instructora Nail Fest" },
  applyFormText: {
    page: "formularios",
    label: "Postulación: texto",
    value: "Cuéntanos quién eres y qué enseñas. Revisamos cada postulación y te escribimos.",
    long: true,
  },
  brandFormTitle: { page: "formularios", label: "Marcas: título", value: "Encuentra instructoras para tu marca" },
  brandFormText: {
    page: "formularios",
    label: "Marcas: texto",
    value: "Cuéntanos qué necesitas: un lanzamiento, una demostración o una capacitación, y en qué ciudad.",
    long: true,
  },
  classFormTitle: { page: "formularios", label: "Reservar clase: título", value: "Reserva tu clase" },
  classFormText: { page: "formularios", label: "Reservar clase: texto", value: "Déjanos tus datos y te escribimos con los detalles.", long: true },
  thanksText: {
    page: "formularios",
    label: "Después de enviar",
    value: "¡Listo! Recibimos tus datos y te escribiremos pronto.",
    long: true,
  },
} as const satisfies Record<string, TextDef>;

export type LibraryTextKey = keyof typeof LIBRARY_TEXTS;

export const LIBRARY_TEXT_KEYS = Object.keys(LIBRARY_TEXTS) as LibraryTextKey[];

export type LibraryTexts = Record<LibraryTextKey, string>;
export type LibrarySections = Record<LibrarySectionKey, boolean>;

export const DEFAULT_POPULAR_SEARCHES = ["Polygel", "Francesa", "Retiro", "Precios"];

/** The admin's texts over the usual ones; an empty text is the usual one. */
export function resolveTexts(saved: unknown): LibraryTexts {
  const map = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  return Object.fromEntries(
    LIBRARY_TEXT_KEYS.map((key) => {
      const value = map[key];
      return [key, typeof value === "string" && value.trim() ? value.trim() : LIBRARY_TEXTS[key].value];
    }),
  ) as LibraryTexts;
}

/** Every section is on unless the admin switched it off. */
export function resolveSections(saved: unknown): LibrarySections {
  const map = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  return Object.fromEntries(LIBRARY_SECTION_KEYS.map((key) => [key, map[key] !== false])) as LibrarySections;
}
