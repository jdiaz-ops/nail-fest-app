// The privacy policy's community part (/privacidad, below the admin's own
// text, 2026-10-24): what the library, the cortos, the instructors'
// directory, the Consultorio, the newsletters and their polls, and the
// community gallery do with people's data. The admin can rewrite it in
// Configuración → Política de privacidad; an empty box is this usual text.
// "## " starts a heading; {correo} is the contact address. No database
// here: the admin's form imports it too.

export const COMMUNITY_PRIVACY_TEXT = [
  "## La comunidad Nail Fest",
  "Además de los eventos, en nailfest.lat tenemos espacios para la comunidad: la biblioteca y los cortos, el directorio de instructoras, el Consultorio, la cuponera y los correos de Nail Fest. Esta parte de la política explica qué datos usamos en cada uno, para qué y cuáles son tus derechos, según la Ley 1581 de 2012 y el Decreto 1377 de 2013.",
  "## Registro gratis de la biblioteca",
  "Si te registras para ver las grabaciones y los pasos a paso, guardamos tu nombre, tu correo, tu ciudad, tu celular si lo das y si quieres recibir novedades. Los usamos para abrirte ese contenido y, solo si lo aceptaste, para enviarte novedades. En tu navegador queda una cookie que recuerda que ya te registraste.",
  "## Cortos y biblioteca",
  "Contamos cuántas veces se ve cada video, sin guardar quién lo vio. Los videos se reproducen desde YouTube (de Google), que tiene su propia política de privacidad.",
  "## Cuenta de instructora",
  "Si creas tu perfil en el directorio de instructoras, guardamos tu usuario, tu correo, tu celular y tu contraseña (cifrada: nadie puede leerla), y lo que pones en tu perfil: nombre, foto, ciudad, especialidades, lo que cuentas de ti, tus redes y, si lo das, un WhatsApp para tus alumnas. Tu perfil es público cuando el equipo lo aprueba. El correo y el celular de tu cuenta nunca se publican: son para que entres y para escribirte sobre tu perfil. También guardamos los videos que nos envías con su ficha, y cuándo aceptaste los términos del directorio y el permiso de uso de contenido.",
  "## Tu cuenta de la comunidad y el Consultorio",
  "Para preguntar, responder y votar en el Consultorio creas una cuenta con tu nombre, tu ciudad, tu correo y una contraseña (cifrada). Tu nombre, tu ciudad, tus preguntas, tus respuestas y las fotos que subas se publican en nailfest.lat/consultorio. Tus votos («Me sirvió») se guardan con tu cuenta y se muestran solo como un total. Tu correo y tu contraseña nunca se publican. El equipo puede ocultar lo que no cumpla las reglas del Consultorio.",
  "## Correos de Nail Fest y sus encuestas",
  "Si aceptaste recibir novedades, te escribimos con contenido, eventos y descuentos. Cuando respondes una encuesta o tocas una opción en uno de esos correos, guardamos tu respuesta en tu ficha, junto a tu correo. Con eso elegimos qué enviarte (por ejemplo, contenido para tu nivel o los eventos de tu ciudad) y hacemos estadísticas de la comunidad, que publicamos siempre sin nombres. Responder es voluntario. Te puedes dar de baja con el enlace al final de cada correo; eso no afecta tus entradas ni los avisos de los eventos a los que te inscribiste.",
  "## Galería de la comunidad",
  "Si nos envías fotos de tus diseños, las publicamos con tu nombre y tu Instagram en nailfest.lat, en los correos y en las redes de Nail Fest solo si lo autorizas al enviarlas. Puedes pedir que las retiremos cuando quieras.",
  "## Con quién compartimos tus datos",
  "No vendemos tus datos. Los compartimos solo con los proveedores que nos ayudan a operar (el alojamiento del sitio y de la base de datos, el envío de correos, WhatsApp de Meta y el almacenamiento de fotos), y únicamente para eso. Las marcas de la cuponera no reciben tus datos: cuando usas un código o un enlace con descuento, la compra la haces directamente en la tienda de cada marca, con sus propias reglas.",
  "## Cuánto tiempo los guardamos",
  "Mientras tengas tu cuenta o tu registro, o hasta que nos pidas borrarlos, salvo que la ley nos obligue a conservarlos. Las estadísticas sin nombres se pueden conservar.",
  "## Tus derechos",
  "Puedes conocer, actualizar y corregir tus datos; pedir prueba de tu autorización; saber cómo los usamos; revocar tu autorización y pedir que los borremos cuando no haya un deber legal de conservarlos, y presentar quejas ante la Superintendencia de Industria y Comercio. Para hacerlo, escríbenos a {correo}. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles.",
  "Esta parte de la política se actualizó el 24 de octubre de 2026.",
].join("\n\n");

export type PolicyBlock = { kind: "heading" | "paragraph"; text: string };

/** The text as headings and paragraphs, with the contact address in place. */
export function policyBlocks(text: string, contactEmail: string | null): PolicyBlock[] {
  const contact = contactEmail ?? "los canales de contacto de esta política";
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith("## ") ? { kind: "heading" as const, text: p.slice(3).trim() } : { kind: "paragraph" as const, text: p.replaceAll("{correo}", contact) }));
}
