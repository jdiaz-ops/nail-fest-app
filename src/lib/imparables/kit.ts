// Manicuristas Imparables' digital kit (the team, 2026-11-04): what every buyer gets by email before the congress,
// with her «Asistiré» image, in her confirmation (lib/imparables/confirmationEmail.ts) — wallpapers for her phone and
// the frame for her profile photo (made in her browser: components/imparables/ImpMarco.tsx, from her «Asistiré» link).
// Not on her recordings page, no WhatsApp stickers and no story templates (the team, 2026-11-04). Each file lives in public/imparables/kit/ (1080×1920, a small copy in
// mini/); the emails and her kit's page («Tu kit Imparable», app/asistire/[token]/kit) read the list from here. Not
// named on the sales page (the team, 2026-11-03).

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
  /** The profile frame, empty, round: its picture on the kit's page. */
  framePreview: `${DIR}/mini/marco.png`,
  /** The diploma with a sample name: how hers will look, until it opens. */
  diplomaPreview: `${DIR}/diploma-muestra.jpg`,
  /** Around her photo in the profile frame. */
  frame: { top: "Manicurista Imparable" },
};
