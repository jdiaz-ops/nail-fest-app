import type { Lettering } from "./titleLettering";

// Nail Fest's own confirmation email for its in-person events (2026-10-30,
// first for Cúcuta), as in the approved boceto: the brand's header with the
// city, «Entrada confirmada», the hello, her ticket — its QR big, her name,
// what kind and for how many, her code — when (each day with its hours) and
// where (with her calendar), her «Asistiré» image, a colleague to invite, and
// help. No map button nor «Antes de ir» since the team's look at it (same day).
// The brand's off-white, teal and peach; tables and inline styles, so it
// reads the same in Gmail, Outlook and the phone's mail app (no confetti in
// its header since the team's test: Gmail can't position it). Chosen per event
// in «Confirmación del evento» (Event.confirmationEmailDesign "NAIL_FEST");
// filled by lib/nailfest/confirmation.ts. Nothing here touches the database.

export interface NailFestTicket {
  qrImageUrl: string;
  holder: string;
  /** «Entrada general», «VIP · 1 de 2» */
  label: string;
  code: string;
}

export interface NailFestConfirmation {
  /** Her first name as it's said; "" when there's none. */
  firstName: string;
  eventName: string;
  /** «Sábado 7 y domingo 8 de noviembre» */
  dates: string;
  /** Each day with its hours: [«Sábado 7», «10:00 a. m. a 6:00 p. m.»]. */
  days: [string, string][];
  venue: { name: string | null; address: string | null };
  /** Her ticket — or, for an order of several, each one. */
  tickets: NailFestTicket[];
  /** «1 persona», «2 personas» — what her order lets in. */
  people: number;
  pdfAttached: boolean;
  calendar: { google: string; ics: string };
  /** Her page to make her «Asistiré» image, and a picture of the empty template. */
  asistire: { url: string; image: string } | null;
  /** WhatsApp's share link with the event's message. */
  share: { url: string };
  /** The team's WhatsApp, when there's one. */
  helpUrl: string | null;
  instagram: { handle: string; url: string };
  images: { logo: string };
  site: { url: string; host: string };
  /** The header's name and days as the event's page writes them. */
  heading: EventHeading;
}

// The brand's colors (globals.css' --accent and EventRegistration's own), and
// the helpers its emails are written with — shared with the event's emails
// (eventEmail.ts).
export const BG = "#faf9f7";
export const PAGE = "#efede8";
export const LINE = "#e3e1dc";
export const INK = "#17181c";
export const GREY = "#5b5f6b";
export const TEAL = "#00beb5";
export const TEAL_DEEP = "#0f7d75";
export const TEAL_INK = "#0b2e2c";
export const MINT = "#e6f9f7";
export const MINT_LINE = "#b7e8e3";
export const MINT_TEXT = "#d6f1ee";
export const PEACH = "#ffc5a8";
export const PEACH_SOFT = "#fff1ea";
export const PINK = "#f6a5b8";

// The faces of the event's page: Inter for the words, Fraunces Black for the
// titles, and the header's name and days as images in it (titleLettering.ts,
// 2026-10-30: the team, like the page). Where the mail app loads fonts
// (Apple's, Samsung's) they're these; Gmail and Outlook load none: the titles
// then fall to a bold sans — Roboto, Helvetica, Arial —, never a newspaper
// serif.
export const SANS = "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const DISPLAY = `Fraunces, ${SANS}`;
export const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,900&amp;family=Inter:wght@400;600;700;800&amp;display=swap" rel="stylesheet">`;
/** The page's teal for the big days (globals.css' --link). */
export const LINK = "#007a74";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const table = (inner: string, style = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;
export const sans = (size: number, weight = 400, color = INK, extra = "") => `font-family:${SANS};font-size:${size}px;font-weight:${weight};color:${color};${extra}`;
export const display = (size: number, weight = 900, color = INK, extra = "") => `font-family:${DISPLAY};font-size:${size}px;font-weight:${weight};color:${color};line-height:1.15;${extra}`;
/** The band under the header: its words as they're written (no forced capitals, the team). */
export const band = (html: string) =>
  `<tr><td align="center" style="padding:11px 18px;background:${TEAL};${sans(15, 800, TEAL_INK, "letter-spacing:0.02em;line-height:1.35;")}">${html}</td></tr>`;

/** The header's name and days as the event's page writes them: «Nail Fest Cúcuta», then the big «7 y 8» with «de
 * noviembre» and «Sábado y domingo · 2026» beside it (lib/eventHeroDate.ts). */
export interface EventHeading {
  name: string;
  days: string;
  month: string;
  detail: string;
  /** Its name and days in Fraunces Black (titleLettering.ts); their words without them. */
  nameImage?: Lettering | null;
  daysImage?: Lettering | null;
}

/** An image of words, its alt in the same face and color for a mail app that hides images. */
const lettered = (image: Lettering, words: string, alt: string) =>
  `<img src="${esc(image.url)}" width="${image.width}" height="${image.height}" alt="${esc(words)}" style="display:block;margin:0 auto;width:${image.width}px;max-width:100%;height:auto;border:0;${alt}">`;

export const eventHeading = (h: EventHeading) =>
  `${
    h.nameImage
      ? lettered(h.nameImage, h.name, display(30))
      : `<div style="${display(30, 900, INK, "letter-spacing:-0.01em;")}">${esc(h.name)}</div>`
  }
<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:2px auto 0;border-collapse:collapse;"><tr>
<td valign="middle" style="padding:0 8px 0 0;">${
    h.daysImage
      ? lettered(h.daysImage, h.days, display(52, 900, LINK, "line-height:1;"))
      : `<div style="${display(52, 900, LINK, "line-height:1;letter-spacing:-0.02em;white-space:nowrap;")}">${esc(h.days)}</div>`
  }</td>
<td valign="middle" align="left" style="text-align:left;"><div style="${sans(20, 700, INK, "line-height:1.1;")}">${esc(h.month)}</div><div style="margin-top:3px;${sans(14, 400, GREY, "line-height:1.3;")}">${esc(h.detail).replace(/ · /g, "&nbsp;·&nbsp;")}</div></td>
</tr></table>`;
const eyebrow = (text: string) => `<div style="${sans(11.5, 800, TEAL_DEEP, "letter-spacing:0.16em;text-transform:uppercase;")}">${esc(text)}</div>`;
export const button = (href: string, label: string, colors = `background:${TEAL};color:${TEAL_INK};`) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:14px 26px;border-radius:999px;${colors}text-decoration:none;${sans(15.5, 800, "inherit")}">${label}</a>`;
const outline = (href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:8px 6px 0 0;padding:8px 15px;border:1.5px solid ${INK};border-radius:999px;text-decoration:none;${sans(13.5, 800, INK)}">${label}</a>`;

/** One ticket as the confirmation shows it — its QR big, her name, what kind (and for how many, when given), her code —
 * also where an event's email asks for it (eventEmail.ts' «{{BOLETA}}»). */
export function ticketCard(t: NailFestTicket, eventName: string, o: { people: string | null; pdfAttached: boolean }): string {
  return table(
    `<tr><td style="padding:12px 18px;background:${INK};border-radius:16px 16px 0 0;">${table(
      `<tr><td style="${sans(11.5, 800, PEACH, "letter-spacing:0.16em;text-transform:uppercase;")}">Tu entrada</td><td align="right" style="${sans(13, 700, "#ffffff")}">${esc(eventName)}</td></tr>`
    )}</td></tr>
<tr><td align="center" style="padding:22px 18px 16px;">
<img src="${esc(t.qrImageUrl)}" width="200" height="200" alt="Código QR de tu entrada" style="display:block;margin:0 auto;width:200px;height:200px;border:0;">
<div style="margin-top:14px;${sans(19, 800)}">${esc(t.holder)}</div>
<div style="margin-top:10px;">
<span style="display:inline-block;margin:0 3px;padding:4px 11px;border-radius:999px;background:${MINT};border:1px solid ${MINT_LINE};${sans(12.5, 700, TEAL_INK)}">${esc(t.label)}</span>${
      o.people
        ? `<span style="display:inline-block;margin:0 3px;padding:4px 11px;border-radius:999px;background:${PEACH_SOFT};border:1px solid #ffd9c6;${sans(12.5, 700, "#7a3d1d")}">${esc(o.people)}</span>`
        : ""
    }
</div>
<div style="margin-top:10px;${sans(12, 400, GREY, "letter-spacing:0.14em;")}">CÓDIGO ${esc(t.code)}</div>
</td></tr>
<tr><td align="center" style="padding:12px 18px;border-top:2px dashed ${LINE};${sans(13.5, 400, GREY)}">Muéstrala en tu celular o impresa${o.pdfAttached ? "<br>También va en PDF adjunto" : ""}</td></tr>`,
    `border:2px solid ${INK};border-radius:18px;background:#ffffff;`
  );
}

/** The event's message for the colleague when it has none of its own. */
export function defaultInvite(eventName: string, dates: string): string {
  const when = `${dates.charAt(0).toLowerCase()}${dates.slice(1)}`;
  // «Es el sábado 7 y domingo 8 de noviembre», «Es del viernes 6 al domingo 8 de noviembre».
  return `¡Vamos juntas a ${eventName}! Es ${when.startsWith("del ") ? "" : "el "}${when} y la entrada es gratis. Inscríbete aquí:`;
}

export function nailFestConfirmationEmail(c: NailFestConfirmation): { html: string; text: string } {
  const hello = c.firstName ? `¡Te esperamos, ${c.firstName}!` : "¡Te esperamos!";
  const manyDays = c.days.length > 1;
  const intro = `Ya tienes tu entrada para <b style="color:${INK};">${esc(c.eventName)}</b>. Muestra ${c.tickets.length > 1 ? "estos códigos" : "este código"} en la entrada${
    manyDays ? ": sirve todos los días, y puedes entrar y salir las veces que quieras" : ", y puedes entrar y salir las veces que quieras"
  }.`;
  const preheader = `Tu entrada para ${c.eventName}: ${c.dates.charAt(0).toLowerCase()}${c.dates.slice(1)}.`;
  const people = `${c.people} ${c.people === 1 ? "persona" : "personas"}`;

  const ticket = (t: NailFestTicket, showPeople: boolean) => ticketCard(t, c.eventName, { people: showPeople ? people : null, pdfAttached: c.pdfAttached });

  const dayRows = c.days
    .map(
      ([day, hours]) =>
        `<tr><td valign="top" width="120" style="width:120px;padding:13px 16px;border-bottom:1px solid ${LINE};${sans(12.5, 700, GREY)}">${esc(day)}</td><td style="padding:13px 16px;border-bottom:1px solid ${LINE};${sans(15, 700)}">${esc(hours)}</td></tr>`
    )
    .join("");
  const venueRow = c.venue.name || c.venue.address
    ? `<tr><td valign="top" width="120" style="width:120px;padding:13px 16px;${sans(12.5, 700, GREY)}">Lugar</td><td style="padding:13px 16px;${sans(15, 700)}">${esc(c.venue.name ?? c.venue.address ?? "")}${
        c.venue.name && c.venue.address ? `<br><span style="${sans(13.5, 400, GREY)}">${esc(c.venue.address)}</span>` : ""
      }<br>${outline(c.calendar.google, "Google Calendar")}${outline(c.calendar.ics, "iPhone · Outlook")}</td></tr>`
    : `<tr><td colspan="2" style="padding:13px 16px;">${outline(c.calendar.google, "Google Calendar")}${outline(c.calendar.ics, "iPhone · Outlook")}</td></tr>`;

  const preheaderFill = "&#847;&zwnj;&nbsp;".repeat(60);
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(hello)}</title>
${FONTS}
<style>
body{margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;}
a{color:inherit;}
@media (max-width:620px){.px{padding-left:20px!important;padding-right:20px!important;}}
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};">${esc(preheader)}${preheaderFill}</div>
${table(
  `<tr><td align="center" style="padding:16px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border-collapse:separate;">
<tr><td align="center" style="padding:28px 16px 24px;background:${BG};">
<img src="${esc(c.images.logo)}" width="120" alt="Nail Fest" style="display:block;margin:0 auto;width:120px;height:auto;border:0;">
<div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
${eventHeading(c.heading)}
</td></tr>
${band("&#10003;&nbsp; Entrada confirmada")}
<tr><td class="px" style="padding:28px 34px 4px;">
<div style="${display(30)}">${esc(hello)}</div>
<div style="margin-top:10px;${sans(16, 400, GREY, "line-height:1.6;")}">${intro}</div>
</td></tr>
${c.tickets.map((t, i) => `<tr><td class="px" style="padding:${i ? 14 : 20}px 34px 0;">${ticket(t, c.tickets.length === 1)}</td></tr>`).join("")}
<tr><td class="px" style="padding:30px 34px 0;">
${eyebrow("Cuándo y dónde")}
<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
${table(dayRows + venueRow, `border:1px solid ${LINE};border-radius:14px;`)}
</td></tr>
${
  c.asistire
    ? `<tr><td class="px" style="padding:30px 34px 0;">${table(
        `<tr><td align="center" style="padding:24px 22px;">
<div style="${display(22)}">¡Cuéntale a todos que vas!</div>
<div style="margin:8px auto 14px;max-width:420px;${sans(15, 400, GREY, "line-height:1.55;")}">Sube una foto tuya y te armamos tu imagen «Asistiré» para historias y publicaciones.</div>
<a href="${esc(c.asistire.url)}" style="display:block;text-decoration:none;"><img src="${esc(c.asistire.image)}" width="132" alt="Tu imagen «¡Asistiré!»" style="display:block;margin:0 auto 16px;width:132px;height:auto;border:0;border-radius:12px;"></a>
${button(c.asistire.url, "Crear mi imagen")}
</td></tr>`,
        `background:${PEACH_SOFT};border-radius:18px;`
      )}</td></tr>`
    : ""
}
<tr><td class="px" style="padding:30px 34px 0;">${table(
  `<tr><td align="center" style="padding:26px 24px;">
<div style="${display(22, 900, "#ffffff")}">¿Vas con una colega?</div>
<div style="margin:8px auto 16px;max-width:400px;${sans(15, 400, MINT_TEXT, "line-height:1.55;")}">La entrada es gratis: compártele el enlace para que se inscriba y tenga la suya.</div>
${button(c.share.url, "Compartir por WhatsApp", `background:#ffffff;color:${TEAL_INK};`)}
</td></tr>`,
  `background:${TEAL_DEEP};border-radius:18px;`
)}</td></tr>
<tr><td class="px" align="center" style="padding:30px 34px 28px;${sans(13.5, 400, GREY, "line-height:1.7;")}">
${c.helpUrl ? `¿Dudas? <a href="${esc(c.helpUrl)}" style="font-weight:700;color:${TEAL_DEEP};">Escríbenos por WhatsApp</a> · ` : ""}Síguenos en <a href="${esc(c.instagram.url)}" style="font-weight:700;color:${TEAL_DEEP};">${esc(c.instagram.handle)}</a>
<img src="${esc(c.images.logo)}" width="70" alt="Nail Fest" style="display:block;margin:12px auto 4px;width:70px;height:auto;border:0;">
Donde se reúne el mundo de las uñas<br>
<span style="font-size:12px;">Recibes este correo porque te inscribiste a ${esc(c.eventName)} · <a href="${esc(c.site.url)}" style="color:${GREY};">${esc(c.site.host)}</a></span>
</td></tr>
</table>
</td></tr>`,
  `background:${PAGE};`
)}
</body>
</html>`;

  const text = [
    hello.toUpperCase(),
    intro.replace(/<[^>]+>/g, ""),
    ...c.tickets.map((t) => [`TU ENTRADA`, `${t.holder} · ${t.label}`, `Código: ${t.code}`, `Tu código QR: ${t.qrImageUrl}`].join("\n")),
    ["CUÁNDO Y DÓNDE", ...c.days.map(([d, h]) => `${d}: ${h}`), ...(c.venue.name || c.venue.address ? [`Lugar: ${[c.venue.name, c.venue.address].filter(Boolean).join(", ")}`] : []), `Agrégalo a tu calendario: ${c.calendar.google}`].join("\n"),
    ...(c.asistire ? [`¡CUÉNTALE A TODOS QUE VAS!\nSube una foto tuya y te armamos tu imagen «Asistiré»: ${c.asistire.url}`] : []),
    `¿VAS CON UNA COLEGA?\nLa entrada es gratis: compártele el enlace para que se inscriba.\n${c.share.url}`,
    ...(c.helpUrl ? [`¿Dudas? Escríbenos por WhatsApp: ${c.helpUrl}`] : []),
    `Síguenos en ${c.instagram.handle} · ${c.site.host}\nRecibes este correo porque te inscribiste a ${c.eventName}.`,
  ].join("\n\n");

  return { html, text };
}
