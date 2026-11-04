// Manicuristas Imparables' digital kit (the team, 2026-11-04): what every buyer gets on her page («Tu congreso») —
// wallpapers for her phone, templates for her stories (before, on the day and after the congress), stickers for
// WhatsApp and the frame for her profile photo (made in her browser: components/imparables/ImpMarco.tsx). Each file
// lives in public/imparables/kit/ (1080×1920 and 512×512, a small copy in mini/); the page reads the list from here.
// It's sent to every buyer but not named on the sales page (the team, 2026-11-03).

const DIR = "/imparables/kit";

export interface KitFile {
  name: string;
  /** The full file, to save. */
  file: string;
  /** Its small copy, to show. */
  mini: string;
}

const item = (name: string, file: string): KitFile => ({ name, file: `${DIR}/${file}`, mini: `${DIR}/mini/${file}` });

export const KIT = {
  wallpapers: [item("Imparable", "fondo-imparable.jpg"), item("Cobro lo que valgo", "fondo-cobro.jpg"), item("Agenda llena", "fondo-agenda.jpg")],
  stories: [item("Antes: «Me voy a…»", "historia-voy.jpg"), item("El día: «Hoy estoy en…»", "historia-hoy.jpg"), item("Después: «3 cosas que aprendí»", "historia-aprendi.jpg")],
  stickers: [
    item("¡Imparable!", "sticker-imparable.png"),
    item("Cobro lo que valgo", "sticker-cobro.png"),
    item("Agenda llena", "sticker-agenda.png"),
    item("Cita confirmada", "sticker-cita.png"),
    item("Gracias por elegirme", "sticker-gracias.png"),
    item("¡Quedaron divinas!", "sticker-divinas.png"),
  ],
  stickersZip: `${DIR}/stickers-imparables.zip`,
  /** The diploma with a sample name: how hers will look, until it opens. */
  diplomaPreview: `${DIR}/diploma-muestra.jpg`,
  /** Around her photo in the profile frame. */
  frame: { top: "Manicurista Imparable" },
};
