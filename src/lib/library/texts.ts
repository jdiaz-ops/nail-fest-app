// Every text and section of the library and the instructors' pages that
// the admin can change or switch off (Editar biblioteca → Textos y
// secciones), with the usual text — what shows while the admin leaves it
// empty. No database here: the admin's form imports it too.

/** Whether the library asks for its free sign-up. Off since 2026-10-25
 * («No me interesa nada gated»): every recording and step by step opens for
 * everyone, no padlock or invitation shows (not even in the team's
 * preview), the admin hides the sign-up's switches, texts and «Pide
 * registro gratis», and /biblioteca/registro sends people back. The
 * sign-ups already made and each video's `gated` stay as they were. */
export const LIBRARY_SIGNUP = false;

export type LibraryPage = "biblioteca" | "shorties" | "video" | "instructoras" | "perfil" | "portal" | "menu" | "formularios";

export const LIBRARY_PAGES: { key: LibraryPage; label: string; hint: string }[] = [
  { key: "biblioteca", label: "Portada de El Taller", hint: "nailfest.lat/biblioteca" },
  { key: "shorties", label: "Explorar (el scroll)", hint: "nailfest.lat/biblioteca/cortos" },
  { key: "video", label: "Página de cada video", hint: "nailfest.lat/biblioteca/<video>" },
  { key: "instructoras", label: "Directorio de instructoras", hint: "nailfest.lat/instructoras" },
  { key: "perfil", label: "Perfil de cada instructora", hint: "nailfest.lat/instructoras/<instructora>" },
  { key: "portal", label: "Portal de instructoras", hint: "Crear perfil (nailfest.lat/instructoras/unirme) y los términos que aceptan" },
  { key: "menu", label: "Menú", hint: "El menú de El Taller y del directorio de instructoras" },
  { key: "formularios", label: "Formularios", hint: LIBRARY_SIGNUP ? "Registro gratis y postulación de instructoras" : "Postulación de instructoras" },
];

interface TextDef {
  page: LibraryPage;
  label: string;
  value: string;
  /** Long texts get a box instead of a line. */
  long?: boolean;
  /** The section it belongs to: shown under that section's switch. */
  section?: LibrarySectionKey;
  /** Only for the free sign-up: hidden in the admin while it's off (LIBRARY_SIGNUP). */
  signup?: true;
}

export const LIBRARY_SECTIONS = {
  shortiesBanner: { page: "biblioteca", label: "Entrada a Explorar", hint: "El recuadro de Explorar debajo del buscador, con los temas más vistos. Sale desde 3 videos." },
  themes: { page: "biblioteca", label: "Explora por tema", hint: "Los ocho temas, con cuántos videos tiene cada uno." },
  newest: { page: "biblioteca", label: "Lo nuevo", hint: "Los últimos videos publicados." },
  mostViewed: { page: "biblioteca", label: "Lo más visto esta semana", hint: "Sale cuando al menos 3 videos tienen visitas en los últimos 7 días." },
  recordings: { page: "biblioteca", label: "Grabaciones de maratones", hint: "Las grabaciones largas de las maratones y los directos." },
  signup: { page: "biblioteca", label: "Registro gratis", hint: "El recuadro que invita a registrarse.", signup: true },
  instructorsRow: { page: "biblioteca", label: "Aprende con", hint: "Las instructoras, con enlace a su perfil." },
  shorties: { page: "shorties", label: "Explorar", hint: "Apagado, no sale en la portada ni en el menú, y su página no abre para el público." },
  shortiesBadge: { page: "shorties", label: "Etiqueta «Nuevo»", hint: "En la entrada de la portada y en el menú." },
  shortiesSignup: { page: "shorties", label: "Invitación a registrarse", hint: "Sale cada 6 videos a quien no se ha registrado.", signup: true },
  used: { page: "video", label: "Lo que usó", hint: "Los productos del video, con el descuento y el código de la cuponera." },
  steps: { page: "video", label: "El paso a paso", hint: "Los pasos del video, uno por uno." },
  related: { page: "video", label: "Sigue con", hint: "Más videos del mismo tema." },
  // On since 2026-10-25 (the team said yes); `off: true` keeps one off until the team switches it on.
  subcategories: {
    page: "biblioteca",
    label: "Subcategorías",
    hint: "Navidad, Halloween… dentro de cada tema, cuando tienen 3 videos o más: en la página del tema, en Explorar y en cada video.",
  },
  directorySearch: { page: "instructoras", label: "Buscador", hint: "Buscar por nombre, ciudad o técnica, debajo del título.", off: true },
  filters: { page: "instructoras", label: "Filtros", hint: "Ciudad y especialidad, arriba de las tarjetas." },
  teachCta: { page: "instructoras", label: "¿Enseñas uñas?", hint: "La invitación a crear su perfil." },
  profileVideos: { page: "perfil", label: "Sus videos", hint: "Los videos de la instructora en El Taller." },
  profileProducts: { page: "perfil", label: "Lo que usa en sus videos", hint: "Las marcas de la cuponera que salen en sus videos." },
  appearances: { page: "perfil", label: "Ha estado en", hint: "Los eventos de Nail Fest en los que ha estado.", off: true },
  menuThemes: { page: "menu", label: "Aprende por tema", hint: "Los temas de El Taller, con cuántos videos tiene cada uno." },
  menuInstructors: { page: "menu", label: "Por instructora", hint: "Las instructoras, con enlace a su perfil." },
  menuCities: { page: "menu", label: "Instructoras por ciudad", hint: "Las ciudades donde hay instructoras." },
  menuSignup: { page: "menu", label: "Registro gratis", hint: "El recuadro que invita a registrarse, al final del menú.", off: true, signup: true },
} as const satisfies Record<string, { page: LibraryPage; label: string; hint: string; off?: true; signup?: true }>;

export type LibrarySectionKey = keyof typeof LIBRARY_SECTIONS;

export const LIBRARY_SECTION_KEYS = Object.keys(LIBRARY_SECTIONS) as LibrarySectionKey[];

export const LIBRARY_TEXTS = {
  // «Biblioteca Nail Fest» until 2026-10-25.
  homeTitle: { page: "biblioteca", label: "Título", value: "El Taller Nail Fest" },
  homeLede: { page: "biblioteca", label: "Texto debajo del título", value: "Clases gratis de uñas con las instructoras Nail Fest: técnicas, negocio y bioseguridad.", long: true },
  searchPlaceholder: { page: "biblioteca", label: "Texto dentro del buscador", value: "Busca una técnica o un producto" },
  shortiesBannerText: {
    page: "biblioteca",
    label: "Texto",
    value: "Todos los videos, uno tras otro: cortos, clases y grabaciones. Elige un tema y desliza.",
    long: true,
    section: "shortiesBanner",
  },
  shortiesBannerButton: { page: "biblioteca", label: "Botón", value: "Empezar a ver", section: "shortiesBanner" },
  themesTitle: { page: "biblioteca", label: "Título", value: "Aprende por tema", section: "themes" },
  newestTitle: { page: "biblioteca", label: "Título", value: "Lo nuevo", section: "newest" },
  mostViewedTitle: { page: "biblioteca", label: "Título", value: "Lo más visto esta semana", section: "mostViewed" },
  recordingsTitle: { page: "biblioteca", label: "Título", value: "Grabaciones de maratones", section: "recordings" },
  lockedLabel: { page: "biblioteca", label: "Candado de las grabaciones", value: "Gratis con registro", section: "recordings", signup: true },
  signupTitle: { page: "biblioteca", label: "Título", value: "Regístrate gratis", section: "signup" },
  signupText: { page: "biblioteca", label: "Texto", value: "Ve las grabaciones completas de las maratones.", long: true, section: "signup" },
  signupButton: { page: "biblioteca", label: "Botón", value: "Registrarme", section: "signup" },
  instructorsRowTitle: { page: "biblioteca", label: "Título", value: "Aprende con", section: "instructorsRow" },
  emptyText: { page: "biblioteca", label: "Mientras no haya videos", value: "Muy pronto: estamos preparando los primeros videos con las instructoras Nail Fest.", long: true },

  // "Cortos" until 2026-10-25, when every video went in: long or short.
  shortiesTitle: { page: "shorties", label: "Nombre", value: "Explorar" },
  shortiesSubtitle: { page: "shorties", label: "Texto debajo del nombre (en computador)", value: "Todos los videos, uno tras otro. Elige un tema, desliza o usa las flechas." },
  shortiesHint: { page: "shorties", label: "Aviso del primer video", value: "Desliza hacia arriba para ver otro" },
  shortiesSound: { page: "shorties", label: "Botón del sonido", value: "Activar sonido" },
  shortiesProfile: { page: "shorties", label: "Botón del perfil", value: "Su perfil" },
  shortiesUsed: { page: "shorties", label: "Botón de los productos", value: "Lo que usó" },
  shortiesSteps: { page: "shorties", label: "Botón del paso a paso", value: "Paso a paso" },
  shortiesShare: { page: "shorties", label: "Botón de compartir", value: "Compartir" },
  shortiesStepsLink: { page: "shorties", label: "Enlace al final de «Lo que usó»", value: "Ver el paso a paso completo" },
  shortiesEndTitle: { page: "shorties", label: "Al terminar: título", value: "Ya los viste todos" },
  shortiesEndText: { page: "shorties", label: "Al terminar: texto", value: "Puedes verlos otra vez en otro orden o seguir en El Taller.", long: true },
  shortiesEndAgain: { page: "shorties", label: "Al terminar: botón para repetir", value: "Verlos otra vez en otro orden" },
  shortiesEndLibrary: { page: "shorties", label: "Al terminar: botón a El Taller", value: "Ir al Taller" },
  shortiesEmpty: { page: "shorties", label: "Mientras no haya videos", value: "Muy pronto: estamos preparando los primeros videos.", long: true },
  shortiesBadgeLabel: { page: "shorties", label: "Etiqueta", value: "Nuevo", section: "shortiesBadge" },
  shortiesSignupTitle: { page: "shorties", label: "Título", value: "¿Te están sirviendo?", section: "shortiesSignup" },
  shortiesSignupText: {
    page: "shorties",
    label: "Texto",
    value: "Regístrate gratis y ve las grabaciones completas de las maratones.",
    long: true,
    section: "shortiesSignup",
  },
  shortiesSignupButton: { page: "shorties", label: "Botón", value: "Registrarme gratis", section: "shortiesSignup" },
  shortiesSignupLater: { page: "shorties", label: "Debajo del botón", value: "O sigue deslizando", section: "shortiesSignup" },

  usedTitle: { page: "video", label: "Título", value: "Lo que usó", section: "used" },
  usedSubtitle: { page: "video", label: "Texto debajo", value: "Con descuento en la Cuponera Nail Fest.", section: "used" },
  buyButton: { page: "video", label: "Botón de cada producto", value: "Comprar", section: "used" },
  stepsTitle: { page: "video", label: "Título", value: "El paso a paso", section: "steps" },
  stepsLockedText: {
    page: "video",
    label: "Texto antes del registro",
    value: "Los pasos de esta técnica, uno por uno. Gratis con tu registro.",
    long: true,
    section: "steps",
    signup: true,
  },
  stepsButton: { page: "video", label: "Botón", value: "Ver el paso a paso", section: "steps", signup: true },
  relatedTitle: { page: "video", label: "Título", value: "Sigue con", section: "related" },

  directoryTitle: { page: "instructoras", label: "Título", value: "El directorio de instructoras de uñas" },
  directoryLede: {
    page: "instructoras",
    label: "Texto debajo del título",
    value: "Encuentra instructoras de uñas por ciudad y especialidad: sus técnicas, sus videos y sus redes.",
    long: true,
  },
  directorySearchPlaceholder: { page: "instructoras", label: "Texto dentro del buscador", value: "Busca por nombre, ciudad o técnica", section: "directorySearch" },
  teachTitle: { page: "instructoras", label: "Título", value: "¿Enseñas uñas?", section: "teachCta" },
  teachText: {
    page: "instructoras",
    label: "Texto",
    value: "Crea tu perfil gratis: que te encuentren por tu ciudad y tu especialidad, con tus redes. Y si quieres, envía tus videos: el equipo elige cuáles salen en El Taller, en nuestras redes y en nuestro correo.",
    long: true,
    section: "teachCta",
  },
  teachButton: { page: "instructoras", label: "Botón", value: "Crear mi perfil", section: "teachCta" },
  directoryEmptyText: { page: "instructoras", label: "Mientras no haya instructoras", value: "Muy pronto: estamos sumando las primeras instructoras al directorio.", long: true },

  sealLabel: { page: "perfil", label: "Sello (solo las que tienen el sello en su ficha)", value: "Instructora invitada Nail Fest" },
  featuredLabel: { page: "perfil", label: "Sello de las destacadas", value: "Destacada" },
  profileVideosTitle: { page: "perfil", label: "Título", value: "Sus videos", section: "profileVideos" },
  profileProductsTitle: { page: "perfil", label: "Título", value: "Lo que usa en sus videos", section: "profileProducts" },
  appearancesTitle: { page: "perfil", label: "Título", value: "Ha estado en", section: "appearances" },

  joinTitle: { page: "portal", label: "Crear perfil: título", value: "Crea tu perfil gratis" },
  joinLede: {
    page: "portal",
    label: "Crear perfil: texto debajo del título",
    value: "Para que alumnas de todo el país te encuentren por tu ciudad y por lo que enseñas, con tus redes.",
    long: true,
  },
  joinActiveTitle: { page: "portal", label: "Instructora activa: título", value: "¿Quieres que te descubran?" },
  joinActiveText: {
    page: "portal",
    label: "Instructora activa: texto",
    value: "Sé instructora activa: envía tus videos con su ficha. El equipo elige cuáles salen en El Taller, en las redes y en el correo de Nail Fest, con tu nombre y tus redes.",
    long: true,
  },
  joinMoneyTitle: { page: "portal", label: "Cómo gana Nail Fest: título", value: "Así gana Nail Fest" },
  joinMoneyText: {
    page: "portal",
    label: "Cómo gana Nail Fest: texto",
    value: "Tu perfil es gratis y no recibes pagos. Algunos productos de los videos tienen enlaces con descuento, y Nail Fest puede recibir una comisión de la marca por esas compras.",
    long: true,
  },
  termsText: {
    page: "portal",
    label: "Términos del directorio (se aceptan al crear la cuenta; deja una línea en blanco entre párrafos)",
    value: [
      "El directorio de instructoras de uñas de Nail Fest es un espacio gratuito para que las alumnas encuentren instructoras por ciudad y especialidad. Crear tu perfil no tiene costo y no genera pagos ni para ti ni para Nail Fest.",
      "Tu perfil lo escribes y lo cuidas tú: tu nombre, tu foto, tu ciudad, tus especialidades, lo que cuentas de ti y tus redes. Lo que publiques tiene que ser verdad y ser tuyo. Puedes cambiarlo o pausarlo cuando quieras, y pedirnos que lo borremos.",
      "El equipo de Nail Fest revisa cada perfil antes de publicarlo. Puede no publicarlo, pedirte cambios u ocultarlo si no cumple estos términos.",
      "Estar en el directorio no te garantiza alumnas, ventas, invitaciones a eventos, maratones ni ningún otro espacio de Nail Fest.",
      "Nail Fest no te cobra ni te paga. Algunos productos de los videos de El Taller tienen enlaces con descuento de la Cuponera Nail Fest, y Nail Fest puede recibir una comisión de la marca por esas compras.",
      "Tu correo y tu celular no se publican: son para que entres a tu cuenta y para escribirte sobre tu perfil. Lo demás de tu perfil es público mientras esté publicado. Tratamos tus datos según nuestra política de privacidad (nailfest.lat/privacidad).",
      "Si tienes dudas o quieres borrar tu perfil, escríbenos por WhatsApp.",
    ].join("\n\n"),
    long: true,
  },
  contentTermsText: {
    page: "portal",
    label: "Permiso de uso de contenido (se acepta con el primer video; deja una línea en blanco entre párrafos)",
    value: [
      "Al enviar un video desde tu portal confirmas que es tuyo: lo grabaste tú o tienes permiso de quienes aparecen, y no usa música ni contenido de otras personas sin permiso.",
      "Le das permiso a Nail Fest, sin costo, para mostrar ese video y sus imágenes en El Taller (la biblioteca de videos de Nail Fest), en sus redes sociales y en sus correos, siempre con tu nombre y tus redes. El video sigue siendo tuyo y sigue en tu canal de YouTube: las vistas son tuyas.",
      "Nail Fest elige qué videos publica y puede no publicar alguno. Enviar un video no garantiza que salga, ni pagos, ni invitaciones a eventos.",
      "Puedes pedirnos que retiremos un video tuyo cuando quieras: lo quitamos de El Taller y no lo usamos en publicaciones nuevas.",
      "Nail Fest puede recibir una comisión de las marcas por las compras hechas con los enlaces con descuento que acompañan los videos.",
    ].join("\n\n"),
    long: true,
  },

  menuSectionsTitle: { page: "menu", label: "Título de las secciones", value: "Secciones" },
  // Biblioteca and Cortos together in the menu (2026-10-25): one line for
  // the library, with its parts as buttons under it.
  menuHome: { page: "menu", label: "Enlace a El Taller", value: "El Taller" },
  menuLibraryHint: { page: "menu", label: "Debajo del enlace a El Taller", value: "Clases gratis de uñas" },
  menuMostViewed: { page: "menu", label: "Botón «Lo más visto»", value: "Lo más visto" },
  menuRecordings: { page: "menu", label: "Botón de las grabaciones", value: "Grabaciones" },
  menuDirectory: { page: "menu", label: "Enlace al directorio de instructoras", value: "Instructoras" },
  menuCuponera: { page: "menu", label: "Enlace a la cuponera", value: "Cuponera" },
  menuThemesTitle: { page: "menu", label: "Título", value: "Aprende por tema", section: "menuThemes" },
  menuInstructorsTitle: { page: "menu", label: "Título", value: "Por instructora", section: "menuInstructors" },
  menuSeeAll: { page: "menu", label: "Enlace a todas", value: "Ver todas", section: "menuInstructors" },
  menuCitiesTitle: { page: "menu", label: "Título", value: "Instructoras por ciudad", section: "menuCities" },

  signupFormTitle: { page: "formularios", label: "Registro gratis: título", value: "Regístrate gratis", signup: true },
  signupFormText: {
    page: "formularios",
    label: "Registro gratis: texto",
    value: "Con tu registro ves las grabaciones completas de las maratones.",
    long: true,
    signup: true,
  },
  applyFormTitle: { page: "formularios", label: "Postulación: título", value: "Postúlate como Instructora Nail Fest" },
  applyFormText: {
    page: "formularios",
    label: "Postulación: texto",
    value: "Cuéntanos quién eres y qué enseñas. Revisamos cada postulación y te escribimos.",
    long: true,
  },
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

/** What the admin switched on or off; the rest as they come — on, but for
 * the ones marked `off`. */
export function resolveSections(saved: unknown): LibrarySections {
  const map = saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  return Object.fromEntries(
    LIBRARY_SECTION_KEYS.map((key) => {
      const value = map[key];
      return [key, typeof value === "boolean" ? value : !("off" in LIBRARY_SECTIONS[key])];
    }),
  ) as LibrarySections;
}
