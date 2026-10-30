import { htmlToPlainText } from "@/lib/email/templates";
import { BG, GREY, INK, LINE, MINT, MINT_LINE, PAGE, PEACH, PEACH_SOFT, PINK, TEAL, TEAL_DEEP, TEAL_INK, button, esc, sans, serif, table } from "./confirmationEmail";

// Nail Fest's design for an event's emails (Correos del evento, 2026-10-30,
// the team's boceto), chosen per event (Event.broadcastDesign "NAIL_FEST"):
// each email as it was written — its subject, body, links and images — in the
// event's frame: the logo, the city big, its days and place, an optional band
// («Falta 1 semana», EmailBroadcast.designBand), and a footer with help and
// Instagram. Its body is ordered on the way: a line that starts with an emoji
// becomes a row with the emoji in its own column (a line right under one
// lines up with its words), a short line ending in «:» a subtitle, a ⚠️ line a
// box, an image full width with round corners, a link alone on its line a
// button — and what comes after a horizontal line, its own card (mint, titled
// by its first line when that's a subtitle, like «Resolvemos tus dudas:»).
// Tables and inline styles, as the confirmation email. Nothing here touches
// the database: lib/nailfest/eventEmailFrame.ts brings the event's part.

export interface NailFestEventEmailFrame {
  eventName: string;
  /** «Cúcuta», big in the header. */
  city: string;
  /** «Sábado 7 y domingo 8 de noviembre» */
  dates: string;
  venue: string | null;
  /** The team's WhatsApp, when there's one. */
  helpUrl: string | null;
  instagram: { handle: string; url: string };
  logo: string;
  site: { url: string; host: string };
}

export interface NailFestEventEmailContent {
  subject: string;
  /** The body as the editor stores it (sanitized). */
  bodyHtml: string;
  /** The band under the header; none when empty. */
  band: string | null;
  /** Whether her ticket's PDF goes with it. */
  pdfAttached: boolean;
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const BLOCKS = new Set(["p", "h1", "h2", "h3", "ul", "ol", "hr", "figure", "img", "blockquote", "iframe"]);

interface Block {
  tag: string;
  attrs: string;
  inner: string;
  outer: string;
}

/** The body's top-level elements, in order — the editor stores well-formed HTML; loose text becomes a paragraph. */
export function topBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const tags = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
  const loose = (text: string) => {
    if (text.trim()) blocks.push({ tag: "p", attrs: "", inner: text.trim(), outer: `<p>${text.trim()}</p>` });
  };
  let depth = 0;
  let open = { tag: "", attrs: "", start: 0, innerStart: 0 };
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tags.exec(html))) {
    const [whole, close, raw, attrs] = m;
    const tag = raw!.toLowerCase();
    const single = VOID.has(tag) || /\/\s*$/.test(attrs!);
    if (depth === 0) {
      if (close) continue;
      loose(html.slice(last, m.index));
      last = m.index + whole.length;
      if (single) blocks.push({ tag, attrs: attrs!, inner: "", outer: whole });
      else {
        depth = 1;
        open = { tag, attrs: attrs!, start: m.index, innerStart: m.index + whole.length };
      }
    } else if (!single) {
      depth += close ? -1 : 1;
      if (depth === 0) {
        blocks.push({ tag: open.tag, attrs: open.attrs, inner: html.slice(open.innerStart, m.index), outer: html.slice(open.start, m.index + whole.length) });
        last = m.index + whole.length;
      }
    }
  }
  if (depth > 0) blocks.push({ tag: open.tag, attrs: open.attrs, inner: html.slice(open.innerStart), outer: html.slice(open.start) });
  else loose(html.slice(last));
  return blocks;
}

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
/** A piece of HTML's words. */
const textOf = (html: string) => decode(html.replace(/<[^>]+>/g, "")).replace(/ /g, " ").trim();

// One emoji — a pictograph with its modifiers and joins, a flag, a keycap — and the spaces after it.
const EMOJI = new RegExp(
  "^((?:\\p{Extended_Pictographic}|\\p{Regional_Indicator}{2}|[#*0-9]\\uFE0F?\\u20E3)(?:\\uFE0F|\\u200D\\p{Extended_Pictographic}|[\\u{1F3FB}-\\u{1F3FF}])*)[\\s\\u00A0]*",
  "u"
);
const WARNING = /^(?:⚠|🚨|❗|‼|⛔)/u;

/** The emoji a paragraph starts with (tags before it aside), and the paragraph without it. */
export function leadingEmoji(inner: string): { emoji: string; rest: string } | null {
  let i = 0;
  while (i < inner.length) {
    if (inner[i] === "<") {
      const end = inner.indexOf(">", i);
      if (end < 0) return null;
      i = end + 1;
    } else if (inner.startsWith("&nbsp;", i)) i += 6;
    else if (/\s/.test(inner[i]!)) i++;
    else break;
  }
  const m = EMOJI.exec(inner.slice(i));
  if (!m) return null;
  return { emoji: m[1]!, rest: inner.slice(0, i) + inner.slice(i + m[0].length) };
}

const attr = (attrs: string, name: string) => new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(attrs)?.[1] ?? null;
const align = (attrs: string) => /text-align:\s*(center|right|justify)/i.exec(attr(attrs, "style") ?? "")?.[1] ?? null;

/** Its words' tags in the design's colors: bold in ink, links in teal, images full width with round corners. */
function inline(html: string): string {
  return html
    .replace(/<strong\b[^>]*>/g, `<strong style="font-weight:700;color:${INK};">`)
    .replace(/<b>/g, `<b style="font-weight:700;color:${INK};">`)
    .replace(/<a\b([^>]*)>/g, (_, attrs: string) => `<a${attrs.replace(/\sstyle="[^"]*"/i, "")} style="color:${TEAL_DEEP};font-weight:700;text-decoration:underline;">`)
    .replace(/<img\b([^>]*?)\/?>/g, (_, attrs: string) => `<img${attrs.replace(/\sstyle="[^"]*"/i, "")} style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:14px;">`);
}

const P = (size: number, extra = "") => `margin:0 0 12px;${sans(size, 400, "#2b2d33", `line-height:1.6;${extra}`)}`;

function row(emoji: string, words: string, extra = ""): string {
  return table(
    `<tr><td width="30" valign="top" style="width:30px;padding:0;font-size:17px;line-height:1.5;">${emoji}</td><td valign="top" style="padding:0;${sans(15.5, 400, "#2b2d33", "line-height:1.55;")}">${inline(words)}</td></tr>`,
    `margin:0 0 10px;${extra}`
  );
}

type Kind = "row" | "warn" | "cont" | "other";

interface Section {
  title: string | null;
  parts: string[];
}

/** Its body, ordered, in cards: what comes after each horizontal line is a card of its own. */
export function designedSections(bodyHtml: string): Section[] {
  const sections: Section[] = [{ title: null, parts: [] }];
  // What the last line was (a row lets the next plain line line up with it), and how many rows its card has.
  const last = { kind: "other" as Kind, rows: 0 };
  const blocks = topBlocks(bodyHtml);
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    const section = sections[sections.length - 1]!;
    const push = (html: string, kind: Kind = "other") => {
      section.parts.push(html);
      last.kind = kind;
    };
    if (b.tag === "hr") {
      sections.push({ title: null, parts: [] });
      last.kind = "other";
      last.rows = 0;
      continue;
    }
    if (b.tag === "iframe") continue;
    if (b.tag === "figure" || b.tag === "img") {
      const caption = /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i.exec(b.inner)?.[1];
      const media = b.tag === "img" ? b.outer : b.inner.replace(/<figcaption[\s\S]*?<\/figcaption>/i, "");
      push(`<div style="margin:4px 0 16px;">${inline(media)}${caption ? `<div style="margin-top:6px;${sans(12.5, 400, GREY)}">${caption}</div>` : ""}</div>`);
      continue;
    }
    if (/^h[123]$/.test(b.tag)) {
      const size = b.tag === "h1" ? 27 : b.tag === "h2" ? 22 : 18;
      push(`<div style="margin:18px 0 10px;${serif(size, 900, INK, `line-height:1.18;${align(b.attrs) ? `text-align:${align(b.attrs)};` : ""}`)}">${inline(b.inner)}</div>`);
      continue;
    }
    if (b.tag === "ul" || b.tag === "ol") {
      const items = b.inner.replace(/<li\b[^>]*>/g, `<li style="margin:0 0 6px;">`);
      push(`<${b.tag} style="margin:0 0 12px;padding-left:22px;${sans(16, 400, "#2b2d33", "line-height:1.6;")}">${inline(items)}</${b.tag}>`);
      continue;
    }
    if (b.tag === "blockquote") {
      push(`<div style="margin:0 0 14px;padding:4px 0 4px 14px;border-left:3px solid ${PINK};${sans(15.5, 400, GREY, "line-height:1.6;font-style:italic;")}">${inline(b.inner)}</div>`);
      continue;
    }
    // A paragraph — or anything else at the top, read as one.
    const inner = b.tag === "p" ? b.inner : BLOCKS.has(b.tag) ? b.inner : b.outer;
    const words = textOf(inner);
    if (!words) {
      if (/<img\b/i.test(inner)) push(`<div style="margin:4px 0 16px;">${inline(inner)}</div>`);
      continue;
    }
    // A section's first line, short and ending in «:», titles its card.
    if (sections.length > 1 && section.parts.length === 0 && !section.title && words.length <= 70 && words.endsWith(":") && !leadingEmoji(inner)) {
      section.title = words.replace(/:$/, "");
      continue;
    }
    if (/^[—–-]{1,3}$/.test(words)) {
      push(`<div style="height:1px;line-height:1px;font-size:0;background:${LINE};margin:18px 0;">&nbsp;</div>`);
      continue;
    }
    const lead = leadingEmoji(inner);
    if (lead) {
      if (WARNING.test(lead.emoji)) {
        // «⚠️ IMPORTANTE:» alone on its line takes the next one in its box.
        const next = blocks[i + 1];
        const nextWords = next?.tag === "p" ? textOf(next.inner) : "";
        const takesNext = textOf(lead.rest).length <= 40 && textOf(lead.rest).endsWith(":") && nextWords && !leadingEmoji(next!.inner) && !nextWords.endsWith(":");
        const more = takesNext ? `<p style="${P(15, "margin:-4px 0 12px 30px;")}">${inline(next!.inner)}</p>` : "";
        if (takesNext) i++;
        push(table(`<tr><td style="padding:12px 14px 2px;">${row(lead.emoji, lead.rest)}${more}</td></tr>`, `margin:6px 0 14px;background:${PEACH_SOFT};border:1px solid #ffd9c6;border-radius:14px;`), "warn");
      } else {
        // In a titled card, its rows apart by a thin line — questions and their answers.
        const apart = section.title && last.rows > 0 ? `border-top:1px solid ${MINT_LINE};padding-top:12px;` : "";
        push(row(lead.emoji, lead.rest, apart), "row");
        last.rows++;
      }
      continue;
    }
    if (words.length <= 70 && words.endsWith(":")) {
      push(`<div style="margin:20px 0 8px;${sans(11.5, 800, TEAL_DEEP, "letter-spacing:0.18em;text-transform:uppercase;")}">${esc(words.replace(/:$/, ""))}</div>`);
      continue;
    }
    // A link alone on its line: a button.
    const link = /^\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*$/i.exec(inner);
    if (link && !/<img\b/i.test(link[2]!)) {
      const href = attr(link[1]!, "href");
      if (href) {
        push(`<div style="margin:10px 0 16px;text-align:${align(b.attrs) ?? "center"};">${button(decode(href), esc(words))}</div>`);
        continue;
      }
    }
    // Right under a row, its words line up with the row's.
    if (last.kind === "row" || last.kind === "cont") {
      push(`<p style="${P(15, "margin:-4px 0 12px 30px;")}">${inline(inner)}</p>`, "cont");
      continue;
    }
    const a = align(b.attrs);
    push(`<p style="${P(16, a ? `text-align:${a};` : "")}">${inline(inner)}</p>`);
  }
  return sections.filter((s) => s.parts.length || s.title);
}

export function nailFestEventEmail(frame: NailFestEventEmailFrame, mail: NailFestEventEmailContent): { subject: string; text: string; html: string } {
  const sections = designedSections(mail.bodyHtml);
  const preheader = textOf(mail.bodyHtml).slice(0, 110);
  const cards = sections
    .map((s, i) => {
      const titled = Boolean(s.title);
      const inner = `${titled ? `<div style="margin:0 0 12px;${serif(21, 900, INK, "line-height:1.2;")}">${esc(s.title!)}</div>` : ""}${s.parts.join("")}`;
      const look = titled ? `background:${MINT};border:1px solid ${MINT_LINE};` : "background:#ffffff;";
      return `<tr><td class="px" style="padding:${i ? 16 : 18}px 18px 0;">${table(`<tr><td class="card" style="padding:${titled ? "22px 24px 14px" : "26px 28px 14px"};">${inner}</td></tr>`, `${look}border-radius:18px;`)}</td></tr>`;
    })
    .join("");
  const confetti = [
    ["8%", "18%", 10, 10, TEAL, "50%", 0],
    ["88%", "14%", 8, 8, PINK, "50%", 0],
    ["14%", "70%", 6, 11, PEACH, "2px", 18],
    ["84%", "66%", 6, 11, TEAL, "2px", -20],
  ]
    .map(([l, t, w, h, c, r, deg]) => `<div style="position:absolute;left:${l};top:${t};width:${w}px;height:${h}px;background:${c};border-radius:${r};transform:rotate(${deg}deg);"></div>`)
    .join("");

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(mail.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,900&amp;family=Inter:wght@400;600;700;800&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;}
a{color:inherit;}
@media (max-width:620px){.px{padding-left:12px!important;padding-right:12px!important;}.card{padding-left:20px!important;padding-right:20px!important;}}
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};">${esc(preheader)}</div>
${table(
  `<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${BG};border-radius:20px;overflow:hidden;border-collapse:separate;">
<tr><td align="center" style="position:relative;padding:28px 24px 22px;background:${BG};">
${confetti}
<img src="${esc(frame.logo)}" width="120" alt="Nail Fest" style="display:block;margin:0 auto;width:120px;height:auto;border:0;">
<div style="margin-top:4px;${serif(46, 900, TEAL_DEEP, "line-height:1;")}">${esc(frame.city)}</div>
<div style="margin-top:8px;${sans(14, 700)}">${esc(frame.dates)}${frame.venue ? ` <span style="font-weight:500;color:${GREY};">· ${esc(frame.venue)}</span>` : ""}</div>
</td></tr>
${mail.band?.trim() ? `<tr><td align="center" style="padding:10px 20px;background:${TEAL};${sans(12.5, 800, TEAL_INK, "letter-spacing:0.16em;text-transform:uppercase;")}">${esc(mail.band.trim())}</td></tr>` : ""}
${cards}
${
  mail.pdfAttached
    ? `<tr><td class="px" style="padding:16px 18px 0;">${table(
        `<tr><td width="52" style="width:52px;padding:14px 0 14px 16px;"><div style="width:40px;height:40px;border-radius:10px;background:${PEACH};text-align:center;${sans(12, 900, INK, "line-height:40px;")}">PDF</div></td><td style="padding:14px 16px 14px 12px;"><div style="${sans(14.5, 700, "#ffffff")}">Tu entrada va adjunta</div><div style="${sans(12.5, 400, "#cfd2d8")}">Muéstrala en la puerta, en el celular o impresa.</div></td></tr>`,
        `background:${INK};border-radius:16px;`
      )}</td></tr>`
    : ""
}
<tr><td class="px" align="center" style="padding:26px 30px 28px;${sans(13, 400, GREY, "line-height:1.7;")}">
${frame.helpUrl ? `¿Dudas? <a href="${esc(frame.helpUrl)}" style="font-weight:700;color:${TEAL_DEEP};text-decoration:none;">Escríbenos por WhatsApp</a> · ` : ""}Síguenos en <a href="${esc(frame.instagram.url)}" style="font-weight:700;color:${TEAL_DEEP};text-decoration:none;">${esc(frame.instagram.handle)}</a>
<img src="${esc(frame.logo)}" width="64" alt="Nail Fest" style="display:block;margin:10px auto 2px;width:64px;height:auto;border:0;">
Donde se reúne el mundo de las uñas<br>
<span style="font-size:12px;">Recibes este correo porque te inscribiste a ${esc(frame.eventName)} · <a href="${esc(frame.site.url)}" style="color:${GREY};">${esc(frame.site.host)}</a></span>
</td></tr>
</table>
</td></tr>`,
  `background:${PAGE};`
)}
</body>
</html>`;

  const text = [
    htmlToPlainText(mail.bodyHtml),
    ...(mail.pdfAttached ? ["Tu entrada va adjunta en PDF: muéstrala en la puerta, en el celular o impresa."] : []),
    ...(frame.helpUrl ? [`¿Dudas? Escríbenos por WhatsApp: ${frame.helpUrl}`] : []),
    `Síguenos en ${frame.instagram.handle} · ${frame.site.host}\nRecibes este correo porque te inscribiste a ${frame.eventName}.`,
  ].join("\n\n");

  return { subject: mail.subject, text, html };
}
