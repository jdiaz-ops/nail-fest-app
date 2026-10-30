// Manicuristas Imparables' own confirmation email (2026-10-29), as in the
// approved boceto: the congress's header and «Cupo confirmado», the hello,
// her ticket (when, where, what she paid, her code, her calendar), what
// happens now in five steps, who's waiting for her, her «Asistiré» image to
// share (2026-10-30), a colleague to share it with, and help. Modules like La Mesa's (lib/mesa/email.ts), in the page's
// bone, chocolate and gold; tables and inline styles, so it reads the same
// in Gmail, Outlook and the phone's mail app. The header is an image
// (public/imparables/correo-cabecera.png) so its type looks the same
// everywhere. Chosen per event in «Confirmación del evento»
// (Event.confirmationEmailDesign); filled by lib/imparables/confirmation.ts.
// Nothing here touches the database.

export interface ImparablesConfirmation {
  /** Her first name as it's said; "" when there's none. */
  firstName: string;
  eventName: string;
  /** "Domingo 27 de junio de 2027" */
  date: string;
  /** "8:00 a. m. a 7:00 p. m.", when every day keeps the same hours. */
  hours: string | null;
  /** "hora Colombia" */
  zone: string;
  /** "27 de junio": the day her Zoom link arrives. */
  day: string;
  /** "8:00 a. m." */
  start: string | null;
  /** How long before the start her Zoom link arrives. */
  linkMinutesBefore: number;
  oneDay: boolean;
  /** What she bought: «Etapa Creyente», «$90.000». */
  purchase: { stage: string; paid: string } | null;
  code: string;
  calendar: { google: string; ics: string };
  /** «Hoy está a $90.000 y luego sube a $120.000: compartirle esto es un buen regalo.», and WhatsApp's share link. */
  share: { line: string; url: string };
  /** Her page to make her «Asistiré» image (lib/imparables/asistire.ts), and a picture of the empty template. */
  asistire: { url: string; image: string } | null;
  /** The team's WhatsApp, when there's one. */
  helpUrl: string | null;
  speakers: { name: string; photoUrl: string }[];
  panel: boolean;
  images: { header: string; logo: string };
  site: { url: string; host: string };
}

// The page's colors (globals.css, --imp-*).
const BONE = "#ede8e1";
const CARD = "#f7f3ec";
const DEEP = "#e9dfcf";
const STAR = "#f3e6cc";
const LINE = "#e9dfcf";
const INK = "#141414";
const WARM = "#5e564c";
const SOFT = "#6f665b";
const CHOCOLATE = "#3b2418";
const CREAM = "#f5f0e8";
const CREAM_SOFT = "#e6dacb";
const BRONZE = "#8c6a3e";
const BRONZE_DEEP = "#6e5230";
const GOLD = "#c9a46a";

const SANS = "Manrope, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "Cinzel, Georgia, 'Times New Roman', serif";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const table = (inner: string, style = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;
const sans = (size: number, weight = 400, color = INK, extra = "") => `font-family:${SANS};font-size:${size}px;font-weight:${weight};color:${color};${extra}`;
const serif = (size: number, weight = 900, color = INK, extra = "") => `font-family:${SERIF};font-size:${size}px;font-weight:${weight};color:${color};line-height:1.15;${extra}`;
const eyebrow = (text: string) => `<div style="${sans(12, 800, BRONZE_DEEP, "letter-spacing:0.14em;text-transform:uppercase;")}">${esc(text)}</div>`;
/** A numbered chip shaped like a nail, as La Mesa's sections. */
const nail = (n: number) =>
  `<div style="width:26px;height:32px;border-radius:13px 13px 7px 7px;background:${GOLD};text-align:center;${sans(13, 800, INK, "line-height:32px;")}">${n}</div>`;

/** «Hoy está a $90.000 y luego sube a $120.000: …» — or, with no price after today's, only the gift. */
export function shareLine(today: string | null, next: string | null): string {
  return today && next ? `Hoy está a ${today} y luego sube a ${next}: compartirle esto es un buen regalo.` : "Compartirle esto es un buen regalo.";
}

export function imparablesConfirmationEmail(c: ImparablesConfirmation): { html: string; text: string } {
  const hello = c.firstName ? `¡Lo lograste, ${c.firstName}!` : "¡Lo lograste!";
  const when = [c.hours, c.zone].filter(Boolean).join(" · ");
  const steps: [string, string][] = [
    ["Guarda este correo", "Es tu comprobante de compra."],
    ["Te escribimos por WhatsApp", "Al número que registraste te llegan los recordatorios del congreso."],
    [
      `El ${c.day}, ${c.linkMinutesBefore} minutos antes`,
      "Te llega tu enlace personal de Zoom por correo y WhatsApp. Es solo tuyo: no lo compartas.",
    ],
    [
      c.start ? `Conéctate a las ${c.start}` : "Conéctate a tiempo",
      `${c.zone.charAt(0).toUpperCase()}${c.zone.slice(1)}: si estás en otro país, ajusta la hora. Ten libreta a mano.`,
    ],
    ["30 días de repetición", `Si te pierdes algo, las grabaciones quedan en ${c.site.host} con tu cuenta.`],
  ];
  const cast = c.speakers.length
    ? `${c.speakers.length} conferencistas${c.panel ? " y un panel" : ""}${c.oneDay ? ", en un solo día" : ""}`
    : "";
  const preheader = `Tu cupo para ${c.eventName} está confirmado. Esto es lo que sigue.`;

  const row = (label: string, value: string, sub: string | null, last = false) =>
    `<tr><td valign="top" width="96" style="width:96px;padding:9px 0${last ? " 14px" : ""};${last ? "" : `border-bottom:1px solid ${LINE};`}${sans(13, 400, SOFT)}">${esc(label)}</td>
<td style="padding:9px 0${last ? " 14px" : ""};${last ? "" : `border-bottom:1px solid ${LINE};`}${sans(15, 700, INK, "line-height:1.4;")}">${value}${sub ? `<br><span style="font-weight:600;color:${WARM};">${esc(sub)}</span>` : ""}</td></tr>`;
  const pill = (href: string, label: string) =>
    `<a href="${esc(href)}" style="display:inline-block;margin:0 6px 8px 0;padding:10px 16px;border:1.5px solid ${BRONZE};border-radius:999px;text-decoration:none;${sans(13.5, 800, BRONZE_DEEP)}">${label}</a>`;

  const faces: string[] = [];
  c.speakers.forEach((p, i) => {
    if (i > 0 && i % 4 === 0) faces.push("</tr><tr>");
    faces.push(
      `<td width="25%" align="center" valign="top" style="padding:6px 2px;"><img src="${esc(p.photoUrl)}" width="60" height="60" alt="" style="display:block;margin:0 auto 6px;width:60px;height:60px;border-radius:50%;border:2px solid ${GOLD};object-fit:cover;"><div style="${sans(12.5, 700)}">${esc(p.name)}</div></td>`
    );
  });
  const lastRow = c.speakers.length % 4;
  if (lastRow) for (let i = lastRow; i < 4; i++) faces.push(`<td width="25%"></td>`);

  const preheaderFill = "&#847;&zwnj;&nbsp;".repeat(60);
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(hello)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@800;900&amp;family=Manrope:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:${DEEP};-webkit-text-size-adjust:100%;}
a{color:inherit;}
@media (max-width:620px){.px{padding-left:20px!important;padding-right:20px!important;}}
</style>
</head>
<body style="margin:0;padding:0;background:${DEEP};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${DEEP};">${esc(preheader)}${preheaderFill}</div>
${table(
  `<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${BONE};border-radius:20px;overflow:hidden;border-collapse:separate;">
<tr><td align="center" style="padding:0;background:${CHOCOLATE};">
<img src="${esc(c.images.header)}" width="600" alt="${esc(c.eventName)}" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
<div style="padding:0 24px 26px;${sans(14, 700, CREAM_SOFT)}">${esc(c.date)} · 100% en vivo</div>
</td></tr>
<tr><td align="center" style="padding:9px 20px;background:${GOLD};${sans(12.5, 800, INK, "letter-spacing:0.16em;")}">&#10003;&nbsp; CUPO CONFIRMADO</td></tr>
<tr><td class="px" style="padding:30px 32px 6px;">
<div style="${serif(30)}">${esc(hello)}</div>
<div style="margin-top:12px;${sans(16, 400, WARM, "line-height:1.6;")}">Tu cupo para <b style="color:${INK};">${esc(c.eventName)}</b> está confirmado. Nadie nace imparable: se hace, y hoy diste el primer paso.</div>
</td></tr>
<tr><td class="px" style="padding:22px 32px 8px;">
${table(
  `<tr><td style="padding:18px 20px 6px;">${eyebrow("Tu entrada")}</td></tr>
<tr><td style="padding:4px 20px 0;">${table(
    [
      row("Cuándo", esc(c.date), when || null),
      row("Dónde", "En vivo por Zoom", "Desde tu celular o tu computador"),
      c.purchase ? row("Tu compra", `${esc(c.purchase.stage)} · ${esc(c.purchase.paid)}`, null) : "",
      row("Código", `<span style="letter-spacing:0.08em;font-weight:800;">${esc(c.code)}</span>`, null, true),
    ].join("")
  )}</td></tr>
<tr><td style="padding:2px 20px 14px;">
<div style="margin:0 0 8px;${sans(13, 700, SOFT)}">Agrégalo a tu calendario:</div>
${pill(c.calendar.google, "&#128197;&nbsp; Google Calendar")}${pill(c.calendar.ics, "iPhone · Outlook")}
</td></tr>`,
  `background:${CARD};border:1.5px solid ${GOLD};border-radius:16px;`
)}
</td></tr>
<tr><td class="px" style="padding:26px 32px 10px;">
<div style="margin-bottom:6px;${serif(22, 800)}">¿Qué pasa ahora?</div>
${table(
  steps
    .map(
      ([title, body], i) =>
        `<tr><td width="40" valign="top" style="width:40px;padding:12px 0;">${nail(i + 1)}</td><td style="padding:12px 0;"><div style="${sans(16, 800)}">${esc(title)}</div><div style="${sans(14.5, 400, WARM, "line-height:1.5;")}">${esc(body)}</div></td></tr>`
    )
    .join("")
)}
</td></tr>
${
  c.speakers.length
    ? `<tr><td class="px" style="padding:24px 32px 26px;background:${STAR};">
${eyebrow("Quiénes te esperan")}
<div style="margin:6px 0 14px;${serif(20, 800)}">${esc(cast)}</div>
${table(`<tr>${faces.join("")}</tr>`)}
</td></tr>`
    : ""
}
${
  c.asistire
    ? `<tr><td class="px" align="center" style="padding:28px 32px 30px;">
<div style="${serif(21, 800, INK, "line-height:1.25;")}">¡Cuéntale a todos que vas!</div>
<div style="margin:10px auto 16px;max-width:420px;${sans(15, 400, WARM, "line-height:1.55;")}">Sube una foto tuya y te armamos tu imagen «Asistiré» para historias y publicaciones.</div>
<a href="${esc(c.asistire.url)}" style="display:block;text-decoration:none;"><img src="${esc(c.asistire.image)}" width="150" alt="Tu imagen «¡Asistiré!»" style="display:block;margin:0 auto 16px;width:150px;height:auto;border:0;border-radius:12px;"></a>
<a href="${esc(c.asistire.url)}" style="display:inline-block;padding:14px 24px;border-radius:14px;background:${GOLD};text-decoration:none;${sans(15.5, 800, INK)}">Crear mi imagen</a>
</td></tr>`
    : ""
}
<tr><td class="px" align="center" style="padding:28px 32px 30px;background:${CHOCOLATE};">
<div style="${serif(21, 800, CREAM, "line-height:1.25;")}">¿Conoces a una colega que lo necesita?</div>
<div style="margin:10px auto 18px;max-width:420px;${sans(15, 400, CREAM_SOFT, "line-height:1.55;")}">${esc(c.share.line)}</div>
<a href="${esc(c.share.url)}" style="display:inline-block;padding:14px 24px;border-radius:14px;background:${GOLD};text-decoration:none;${sans(15.5, 800, INK)}">Compartir por WhatsApp</a>
</td></tr>
${
  c.helpUrl
    ? `<tr><td class="px" align="center" style="padding:22px 32px 6px;${sans(14.5, 400, WARM)}">¿Dudas? <a href="${esc(c.helpUrl)}" style="font-weight:800;color:${BRONZE_DEEP};">Escríbenos por WhatsApp</a></td></tr>`
    : ""
}
<tr><td class="px" align="center" style="padding:16px 32px 26px;${sans(12, 400, SOFT, "line-height:1.6;")}">
<img src="${esc(c.images.logo)}" width="38" height="30" alt="Nail Fest" style="display:block;margin:0 auto 8px;border:0;width:38px;height:30px;">
Organiza <b style="color:${INK};">Nail Fest</b> · <a href="${esc(c.site.url)}" style="color:${SOFT};">${esc(c.site.host)}</a><br>
Recibes este correo porque compraste tu entrada a ${esc(c.eventName)}.
</td></tr>
</table>
</td></tr>`,
  `background:${DEEP};`
)}
</body>
</html>`;

  const text = [
    `${hello.toUpperCase()}`,
    `Tu cupo para ${c.eventName} está confirmado. Nadie nace imparable: se hace, y hoy diste el primer paso.`,
    [
      "TU ENTRADA",
      `Cuándo: ${c.date}${when ? ` · ${when}` : ""}`,
      "Dónde: en vivo por Zoom, desde tu celular o tu computador",
      ...(c.purchase ? [`Tu compra: ${c.purchase.stage} · ${c.purchase.paid}`] : []),
      `Código: ${c.code}`,
      `Agrégalo a tu calendario: ${c.calendar.google}`,
      `iPhone u Outlook: ${c.calendar.ics}`,
    ].join("\n"),
    ["¿QUÉ PASA AHORA?", ...steps.map(([title, body], i) => `${i + 1}. ${title}${title.endsWith(".") ? "" : "."} ${body}`)].join("\n"),
    ...(cast ? [`QUIÉNES TE ESPERAN\n${cast}: ${c.speakers.map((p) => p.name).join(", ")}.`] : []),
    ...(c.asistire ? [`¡CUÉNTALE A TODOS QUE VAS!\nSube una foto tuya y te armamos tu imagen «Asistiré» para historias y publicaciones: ${c.asistire.url}`] : []),
    `¿CONOCES A UNA COLEGA QUE LO NECESITA?\n${c.share.line}\n${c.share.url}`,
    ...(c.helpUrl ? [`¿Dudas? Escríbenos por WhatsApp: ${c.helpUrl}`] : []),
    `Organiza Nail Fest · ${c.site.host}\nRecibes este correo porque compraste tu entrada a ${c.eventName}.`,
  ].join("\n\n");

  return { html, text };
}

// ── Her calendar ────────────────────────────────────────────────────────────

/** "20270627T130000Z" */
function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export interface CalendarEvent {
  uid: string;
  title: string;
  start: Date;
  end: Date;
  description: string;
  location: string;
  url: string;
}

/** Google Calendar's «add this event» link. */
export function googleCalendarUrl(e: CalendarEvent): string {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", e.title);
  url.searchParams.set("dates", `${stamp(e.start)}/${stamp(e.end)}`);
  url.searchParams.set("details", `${e.description}\n${e.url}`);
  url.searchParams.set("location", e.location);
  return url.toString();
}

/** iCalendar text, escaped as RFC 5545 asks. */
function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets go on continued lines (RFC 5545 §3.1). */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const ch of line) {
    if (Buffer.byteLength(current + ch, "utf8") > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
    }
    current += ch;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The event as an .ics file — what iPhone and Outlook add to a calendar — with a reminder an hour before. */
export function icsCalendar(e: CalendarEvent, now: Date = new Date()): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nail Fest//Congresos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${icsText(e.title)}`,
    `DESCRIPTION:${icsText(`${e.description}\n${e.url}`)}`,
    `LOCATION:${icsText(e.location)}`,
    `URL:${e.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(e.title)}`,
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}
