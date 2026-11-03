// Manicuristas Imparables «Qué incluye tu cupo» (the team, 2026-11-03), word for word — in place of «Todo lo que trae
// tu boleta» (its heading and its cards): its eyebrow, a line in italics and seven cards (an icon, a title, a line), in
// the order the team marked (2026-11-03: no «antes, durante, después» labels). Every word is here, to edit by hand; the
// page reads it from here (components/imparables/ImparablesBlocks.tsx). Nothing about guides to download, exclusive
// discounts or the notebook: not confirmed.
export type IncluyeIcon = "photo" | "sparkles" | "live" | "flower" | "gift" | "replay" | "award";

export interface IncluyeItem {
  icon: IncluyeIcon;
  title: string;
  text: string;
}

export const INCLUYE = {
  eyebrow: "Qué incluye tu cupo",
  subtitle: "Primera edición. Las que entren este año son la generación fundadora de Manicuristas Imparables.",
  items: [
    { icon: "live", title: "8 conferencistas que ya lo lograron", text: "En vivo, un domingo completo, de 8 a. m. a 6:30 p. m., desde tu celular." },
    {
      icon: "flower",
      title: "Un día pensado para tu cuerpo",
      text: "4 pausas activas para manos, espalda y ojos, guiadas por @ssanchezacademy, manicurista y fisioterapeuta.",
    },
    { icon: "replay", title: "Vuélvelo a ver cuando quieras", text: "Las charlas grabadas quedan disponibles 30 días para que las puedas repetir." },
    {
      icon: "award",
      title: "Tu diploma digital Imparable 2027",
      text: "Con tu nombre, firmado por todos los conferencistas, listo para imprimir y colgar en tu espacio de trabajo.",
    },
    { icon: "gift", title: "Premios en vivo", text: "Sorteos con premios de las marcas aliadas durante el día, entre quienes estén conectadas." },
    {
      icon: "photo",
      title: "Tu tarjeta de bienvenida",
      text: "Tu foto, tu nombre y tu ciudad en el muro de las Imparables, lista para compartir en tus historias.",
    },
    {
      icon: "sparkles",
      title: "Tu kit Imparable",
      text: "Stickers de WhatsApp, fondos de pantalla, marco para tu foto de perfil y plantillas para tus historias.",
    },
  ] satisfies IncluyeItem[],
};

/** The section it takes the place of: the one whose title is «Todo lo que trae tu boleta». (On the version that sells
 * the transformation it's already «Lo que te llevas», and stays so.) */
export function isTicketIncludesTitle(title: string | null | undefined): boolean {
  return (title ?? "").trim().toLowerCase() === "todo lo que trae tu boleta";
}
