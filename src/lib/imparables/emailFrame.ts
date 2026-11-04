// Manicuristas Imparables' email design (its confirmation's, lib/imparables/confirmationEmail.ts, 2026-10-29): the
// colors, the faces and the pieces its other emails are built from (2026-11-04) — the frame (the cover with the day,
// the gold band, the footer), titles, text, buttons and the stars. Tables and inline styles, as email needs.

export const C = {
  BONE: "#ede8e1",
  CARD: "#f7f3ec",
  DEEP: "#e9dfcf",
  STAR: "#f3e6cc",
  LINE: "#e9dfcf",
  INK: "#141414",
  WARM: "#5e564c",
  SOFT: "#6f665b",
  CHOCOLATE: "#3b2418",
  CREAM: "#f5f0e8",
  CREAM_SOFT: "#e6dacb",
  BRONZE: "#8c6a3e",
  BRONZE_DEEP: "#6e5230",
  GOLD: "#c9a46a",
} as const;

const SANS = "Manrope, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Cinzel, Georgia, 'Times New Roman', serif";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const table = (inner: string, style = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;
export const sans = (size: number, weight = 400, color: string = C.INK, extra = "") => `font-family:${SANS};font-size:${size}px;font-weight:${weight};color:${color};${extra}`;
export const serif = (size: number, weight = 900, color: string = C.INK, extra = "") =>
  `font-family:${SERIF};font-size:${size}px;font-weight:${weight};color:${color};line-height:1.15;${extra}`;
export const eyebrow = (text: string, color: string = C.BRONZE_DEEP) => `<div style="${sans(12, 800, color, "letter-spacing:0.14em;text-transform:uppercase;")}">${esc(text)}</div>`;

/** A button: gold, or outlined in gold (a second one beside it). */
export function button(url: string, label: string, kind: "gold" | "outline" = "gold"): string {
  const look = kind === "gold" ? `padding:14px 24px;background:${C.GOLD};` : `padding:12px 22px;border:2px solid ${C.GOLD};`;
  return `<a href="${esc(url)}" style="display:inline-block;${look}border-radius:14px;text-decoration:none;${sans(15.5, 800, C.INK)}">${esc(label)}</a>`;
}

/** Five stars, each one opening `url` with its number of stars (?estrellas=1…5). */
export function stars(url: string, color: string = C.GOLD): string {
  const join = url.includes("?") ? "&" : "?";
  return [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<a href="${esc(`${url}${join}estrellas=${n}`)}" title="${n} de 5" style="display:inline-block;padding:0 3px;text-decoration:none;font-size:34px;line-height:1;color:${color};">&#9733;</a>`
    )
    .join("");
}

export interface EmailFrame {
  /** The tab's title: the email's subject. */
  title: string;
  /** What the inbox shows under the subject. */
  preheader: string;
  header: { image: string; alt: string; line: string };
  /** The gold band under the cover: «✓ CUPO CONFIRMADO», «FALTAN 7 DÍAS»; none when empty. */
  band?: string | null;
  /** The email's own rows (<tr>…</tr>), in order. */
  rows: string[];
  footer: { logo: string; siteUrl: string; host: string; why: string };
}

/** The whole email: the cover with the day, the band, its rows and the footer. */
export function emailDocument(f: EmailFrame): string {
  const preheaderFill = "&#847;&zwnj;&nbsp;".repeat(60);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(f.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@800;900&amp;family=Manrope:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:${C.DEEP};-webkit-text-size-adjust:100%;}
a{color:inherit;}
@media (max-width:620px){.px{padding-left:20px!important;padding-right:20px!important;}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.DEEP};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.DEEP};">${esc(f.preheader)}${preheaderFill}</div>
${table(
  `<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${C.BONE};border-radius:20px;overflow:hidden;border-collapse:separate;">
<tr><td align="center" style="padding:0;background:${C.CHOCOLATE};">
<img src="${esc(f.header.image)}" width="600" alt="${esc(f.header.alt)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
<div style="padding:0 24px 26px;${sans(14, 700, C.CREAM_SOFT)}">${esc(f.header.line)}</div>
</td></tr>
${f.band?.trim() ? `<tr><td align="center" style="padding:9px 20px;background:${C.GOLD};${sans(12.5, 800, C.INK, "letter-spacing:0.16em;")}">${esc(f.band.trim().toLocaleUpperCase("es"))}</td></tr>` : ""}
${f.rows.join("\n")}
<tr><td class="px" align="center" style="padding:16px 32px 26px;${sans(12, 400, C.SOFT, "line-height:1.6;")}">
<img src="${esc(f.footer.logo)}" width="38" height="30" alt="Nail Fest" style="display:block;margin:0 auto 8px;border:0;width:38px;height:30px;">
Organiza <b style="color:${C.INK};">Nail Fest</b> · <a href="${esc(f.footer.siteUrl)}" style="color:${C.SOFT};">${esc(f.footer.host)}</a><br>
${esc(f.footer.why)}
</td></tr>
</table>
</td></tr>`,
  `background:${C.DEEP};`
)}
</body>
</html>`;
}
