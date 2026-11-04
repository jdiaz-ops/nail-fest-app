import { htmlToPlainText } from "@/lib/email/templates";
import { leadingEmoji, paragraphLines, topBlocks } from "@/lib/nailfest/eventEmail";
import { TICKET_TAG } from "@/lib/nailfest/eventTickets";
import type { KitLink } from "./confirmationEmail";
import { button, C, emailDocument, esc, kitRows, sans, serif, table } from "./emailFrame";
import { PILLARS } from "./schedule";

// Manicuristas Imparables' design for its event's emails («Correos del evento», the team's boceto, 2026-11-04), chosen
// per event (Event.broadcastDesign "IMPARABLES"), as Nail Fest's is for its events at a place
// (lib/nailfest/eventEmail.ts): each email as the team wrote it — its subject, its text, links and images — in the
// congress's frame (its cover with the day, an optional gold band, the footer), in the faces and colors of its
// confirmation; then the blocks each email switches on: her «Asistiré» image, her kit (wallpapers, story templates and
// her profile frame) and a colleague to invite. Its text is ordered on the way: headings in Cinzel, a short line
// ending in «:» a subtitle, a line starting with an emoji a row with the emoji apart, a ⚠️ line a box, a link alone on
// its line a gold button, images full width with round corners. The wide image it may open with gives way to the
// cover (eventEmailFrame.ts's bannerOf). Nothing here touches the database: imparables/eventEmailFrame.ts brings the
// event's part.

export interface ImparablesEventEmailFrame {
  /** «Manicuristas Imparables» */
  eventName: string;
  /** Under the cover: «Domingo 4 de julio de 2027 · En vivo por Zoom». */
  /** Under the cover's mark: «4 de julio 2027», «Congreso virtual en vivo» (schedule.ts coverPill). */
  cover: { date: string; note: string };
  /** «¿Conoces a una colega que lo necesita?»: its line and WhatsApp with the event's invitation written. */
  share: { line: string; url: string };
  /** The team's WhatsApp, when there's one. */
  helpUrl: string | null;
  images: { header: string; logo: string; asistire: string };
  kit: { wallpapers: KitLink[] };
  site: { url: string; host: string };
}

export interface ImparablesEventEmailContent {
  subject: string;
  /** The body as the editor stores it (sanitized). */
  bodyHtml: string;
  /** The band under the cover; none when empty. */
  band: string | null;
  /** Her page to make her «Asistiré» image; no block without it (or when the email leaves it out). */
  asistire: string | null;
  /** Her kit: its page and her profile frame's; no block without it (or when the email leaves it out). */
  kit: { frameUrl: string; pageUrl: string } | null;
  /** Whether it invites a colleague. */
  colega: boolean;
  /** The email's banner to leave out: the src of the wide image it opens with. */
  banner: string | null;
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/ /g, " ").trim();
const attr = (attrs: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs)?.[1] ?? null;
const align = (attrs: string) => /text-align:\s*(center|right|justify)/i.exec(attr(attrs, "style") ?? "")?.[1] ?? null;
const WARNING = /^(?:⚠|🚨|❗|‼|⛔)/u;

/** Its words' inline marks in the design: bold in ink, links in bronze, images full width. */
function inline(html: string): string {
  return html
    .replace(/<strong\b[^>]*>/g, `<strong style="font-weight:800;color:${C.INK};">`)
    .replace(/<b>/g, `<b style="font-weight:800;color:${C.INK};">`)
    .replace(/<a\b([^>]*)>/g, (_, attrs: string) => `<a${attrs.replace(/\sstyle="[^"]*"/i, "")} style="color:${C.BRONZE_DEEP};font-weight:800;text-decoration:underline;">`)
    .replace(/<img\b([^>]*?)\/?>/g, (_, attrs: string) => `<img${attrs.replace(/\sstyle="[^"]*"/i, "")} style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:14px;">`);
}

/** Two columns: the emoji (or nothing, for the lines under it) and its words. */
function row(emoji: string, words: string): string {
  return table(
    `<tr><td width="30" valign="top" style="width:30px;padding:0;font-size:17px;line-height:1.5;">${emoji || "&nbsp;"}</td><td valign="top" style="padding:0;${sans(16, 400, C.WARM, "line-height:1.55;")}">${inline(words)}</td></tr>`,
    "margin:0 0 10px;"
  );
}

/** Whether a block is the image the body opens with, the one the cover replaces. */
function isBanner(tag: string, inner: string, outer: string, banner: string | null): boolean {
  if (!banner || !/^(figure|img|p)$/.test(tag)) return false;
  const html = tag === "img" ? outer : inner;
  if (textOf(html.replace(/<figcaption[\s\S]*?<\/figcaption>/i, ""))) return false;
  return attr(/<img\b([^>]*)>/i.exec(html)?.[1] ?? "", "src") === banner;
}

/** Its text in the design, block by block. */
export function imparablesBody(bodyHtml: string, banner: string | null = null): string {
  const parts: string[] = [];
  const blocks = topBlocks(bodyHtml.split(TICKET_TAG).join("")).flatMap((b) =>
    b.tag === "p" ? paragraphLines(b.inner).map((inner) => ({ ...b, inner, outer: `<p${b.attrs}>${inner}</p>` })) : [b]
  );
  const first = blocks.findIndex((b) => b.tag !== "p" || textOf(b.inner) || /<img\b/i.test(b.inner));
  let lastWasRow = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const push = (html: string, isRow = false) => {
      parts.push(html);
      lastWasRow = isRow;
    };
    if (i === first && isBanner(b.tag, b.inner, b.outer, banner)) continue;
    if (b.tag === "iframe") continue;
    if (b.tag === "hr") {
      push(`<div style="height:1px;line-height:1px;font-size:0;background:${C.GOLD};margin:20px auto;width:72px;">&nbsp;</div>`);
      continue;
    }
    if (b.tag === "figure" || b.tag === "img") {
      const caption = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(b.inner)?.[1];
      const media = b.tag === "img" ? b.outer : b.inner.replace(/<figcaption[\s\S]*?<\/figcaption>/i, "");
      push(`<div style="margin:6px 0 16px;">${inline(media)}${caption ? `<div style="margin-top:6px;${sans(13, 400, C.SOFT)}">${caption}</div>` : ""}</div>`);
      continue;
    }
    if (/^h[123]$/.test(b.tag)) {
      const size = b.tag === "h1" ? 30 : b.tag === "h2" ? 23 : 19;
      const a = align(b.attrs);
      push(`<div style="margin:${parts.length ? "18px" : "0"} 0 12px;${serif(size, 900, C.INK, `line-height:1.15;${a ? `text-align:${a};` : ""}`)}">${inline(b.inner)}</div>`);
      continue;
    }
    if (b.tag === "ul" || b.tag === "ol") {
      const items = b.inner.replace(/<li\b[^>]*>/g, `<li style="margin:0 0 6px;">`);
      push(`<${b.tag} style="margin:0 0 14px;padding-left:22px;${sans(16, 400, C.WARM, "line-height:1.6;")}">${inline(items)}</${b.tag}>`);
      continue;
    }
    if (b.tag === "blockquote") {
      push(`<div style="margin:0 0 14px;padding:4px 0 4px 14px;border-left:3px solid ${C.GOLD};${sans(16, 400, C.WARM, "line-height:1.6;font-style:italic;")}">${inline(b.inner)}</div>`);
      continue;
    }
    const inner = b.tag === "p" ? b.inner : b.outer;
    const words = textOf(inner);
    if (!words) {
      if (/<img\b/i.test(inner)) push(`<div style="margin:6px 0 16px;">${inline(inner)}</div>`);
      continue;
    }
    const lead = leadingEmoji(inner);
    if (lead) {
      if (WARNING.test(lead.emoji)) {
        push(table(`<tr><td style="padding:12px 14px 2px;">${row(lead.emoji, lead.rest)}</td></tr>`, `margin:6px 0 14px;background:${C.STAR};border:1px solid ${C.GOLD};border-radius:14px;`));
      } else {
        push(row(lead.emoji, lead.rest), true);
      }
      continue;
    }
    // A short line ending in «:», a subtitle.
    if (words.length <= 70 && words.endsWith(":")) {
      push(`<div style="margin:18px 0 8px;${sans(15.5, 800, C.BRONZE_DEEP, "line-height:1.4;")}">${esc(words)}</div>`);
      continue;
    }
    // A link alone on its line: a button.
    const link = /^\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*$/i.exec(inner);
    if (link && !/<img\b/i.test(link[2]!)) {
      const href = attr(link[1]!, "href");
      if (href) {
        push(`<div style="margin:12px 0 18px;text-align:${align(b.attrs) ?? "center"};">${button(decode(href), words)}</div>`);
        continue;
      }
    }
    // Right under a row, its words line up with the row's.
    if (lastWasRow) {
      push(row("", inner), true);
      continue;
    }
    const a = align(b.attrs);
    push(`<p style="margin:0 0 12px;${sans(16, 400, C.WARM, `line-height:1.6;${a ? `text-align:${a};` : ""}`)}">${inline(inner)}</p>`);
  }
  return parts.join("\n");
}

export function imparablesEventEmail(frame: ImparablesEventEmailFrame, mail: ImparablesEventEmailContent): { subject: string; text: string; html: string } {
  const section = (inner: string, style = "") => `<tr><td class="px" align="center" style="padding:28px 32px 30px;${style}">${inner}</td></tr>`;
  const title = (text: string, color: string = C.INK) => `<div style="${serif(21, 800, color, "line-height:1.25;")}">${esc(text)}</div>`;
  const line = (text: string, color: string = C.WARM) => `<div style="margin:10px auto 18px;max-width:420px;${sans(15, 400, color, "line-height:1.55;")}">${text}</div>`;
  const body = imparablesBody(mail.bodyHtml, mail.banner);

  const rows = [
    ...(body ? [`<tr><td class="px" style="padding:30px 32px 12px;">${body}</td></tr>`] : []),
    ...(mail.asistire
      ? [
          section(
            `${title("¡Cuéntale a todos que vas!")}
${line("Sube una foto tuya y te armamos tu imagen «Asistiré» para historias y publicaciones.")}
<a href="${esc(mail.asistire)}" style="display:block;text-decoration:none;"><img src="${esc(frame.images.asistire)}" width="150" alt="Tu imagen «¡Asistiré!»" style="display:block;margin:0 auto 16px;width:150px;height:auto;border:0;border-radius:12px;"></a>
${button(mail.asistire, "Crear mi imagen")}`,
            `border-top:1px solid ${C.LINE};`
          ),
        ]
      : []),
    ...(mail.kit
      ? [
          section(
            `${title("Tu kit Imparable")}
${line("Fondos de pantalla para tu celular y el marco del congreso para tu foto de perfil. Toca el fondo que quieras para guardarlo.")}
${kitRows(frame.kit.wallpapers)}
<div style="margin:8px 0 0;">${button(mail.kit.pageUrl, "Ver todo mi kit")}</div>
<div style="margin:22px auto 14px;max-width:420px;${sans(15, 400, C.WARM, "line-height:1.55;")}">Y pon tu foto en el marco del congreso para tu perfil de WhatsApp e Instagram.</div>
${button(mail.kit.frameUrl, "Hacer mi foto de perfil", "outline")}`,
            `background:${C.CARD};border-top:1px solid ${C.LINE};`
          ),
        ]
      : []),
    ...(mail.colega
      ? [
          section(
            `${title("¿Conoces a una colega que lo necesita?", C.CREAM)}
${line(esc(frame.share.line), C.CREAM_SOFT)}
${button(frame.share.url, "Compartir por WhatsApp")}`,
            `background:${C.CHOCOLATE};`
          ),
        ]
      : []),
    ...(frame.helpUrl
      ? [
          `<tr><td class="px" align="center" style="padding:22px 32px 6px;${sans(14.5, 400, C.WARM)}">¿Dudas? <a href="${esc(frame.helpUrl)}" style="font-weight:800;color:${C.BRONZE_DEEP};">Escríbenos por WhatsApp</a></td></tr>`,
        ]
      : []),
  ];

  const preheader = textOf(mail.bodyHtml.split(TICKET_TAG).join("")).slice(0, 110);
  const html = emailDocument({
    title: mail.subject,
    preheader,
    header: { image: frame.images.header, alt: frame.eventName, pillars: PILLARS, ...frame.cover },
    band: mail.band,
    rows,
    footer: { logo: frame.images.logo, siteUrl: frame.site.url, host: frame.site.host, why: `Recibes este correo porque compraste tu entrada a ${frame.eventName}.` },
  });

  const text = [
    htmlToPlainText(mail.bodyHtml).split(TICKET_TAG).join(""),
    ...(mail.asistire ? [`¡CUÉNTALE A TODOS QUE VAS!\nSube una foto tuya y te armamos tu imagen «Asistiré»: ${mail.asistire}`] : []),
    ...(mail.kit
      ? [
          [
            "TU KIT IMPARABLE",
            ...frame.kit.wallpapers.map((f) => `Fondo de pantalla «${f.name}»: ${f.file}`),
            `Tu foto de perfil con el marco del congreso: ${mail.kit.frameUrl}`,
            `Todo tu kit: ${mail.kit.pageUrl}`,
          ].join("\n"),
        ]
      : []),
    ...(mail.colega ? [`¿CONOCES A UNA COLEGA QUE LO NECESITA?\n${frame.share.line}\n${frame.share.url}`] : []),
    ...(frame.helpUrl ? [`¿Dudas? Escríbenos por WhatsApp: ${frame.helpUrl}`] : []),
    `Organiza Nail Fest · ${frame.site.host}\nRecibes este correo porque compraste tu entrada a ${frame.eventName}.`,
  ].join("\n\n");

  return { subject: mail.subject, text, html };
}
