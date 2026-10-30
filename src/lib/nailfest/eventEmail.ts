import { htmlToPlainText } from "@/lib/email/templates";
import { BG, FONTS, GREY, INK, LINE, MINT, MINT_LINE, MINT_TEXT, PAGE, PEACH_SOFT, PINK, TEAL_DEEP, TEAL_INK, band, button, cityHeading, display, esc, sans, table } from "./confirmationEmail";
import type { CityLettering } from "./cityLettering";

// Nail Fest's design for an event's emails (Correos del evento, 2026-10-30,
// the team's boceto), chosen per event (Event.broadcastDesign "NAIL_FEST"):
// each email as it was written — its subject, body, links and images — in the
// event's frame: the logo, the city big in Nail Fest's script, its days and
// place, an optional band («Falta 1 semana», EmailBroadcast.designBand, as
// it's written), her «Asistiré» image and a colleague to invite — right after
// its message, before its doubts (the team, same day) —, and a footer with
// help and Instagram; in the faces of Nail Fest's banners (confirmationEmail.ts).
// The email's own banner, the wide image it opens with, gives way to the
// frame's header (the team: it said the same twice). Its body is ordered on the way: a line that
// starts with an emoji becomes a row with the emoji in its own column (lines
// right under it line up with its words), a short line ending in «:» a
// subtitle, a ⚠️ line a box, an image full width with round corners, a link
// alone on its line a button — and what comes after a horizontal line, its own
// card (mint, titled by its first line when that's a subtitle, like
// «Resolvemos tus dudas:»). Lines written in one paragraph (Shift+Enter) are
// read as the lines they are. Tables, inline styles and no positioning: Gmail
// drops <style> for accounts that aren't Google's, and position and negative
// margins everywhere (the team's test, 2026-10-30). Nothing here touches the
// database: lib/nailfest/eventEmailFrame.ts brings the event's part.

export interface NailFestEventEmailFrame {
  eventName: string;
  /** «Cúcuta», big in the header. */
  city: string;
  /** The city in Nail Fest's script (cityLettering.ts); its words without it. */
  cityLettering?: CityLettering | null;
  /** «Sábado 7 y domingo 8 de noviembre» */
  dates: string;
  venue: string | null;
  /** WhatsApp with the event's invitation written, for «¿Vas con una colega?». */
  share: { url: string; free: boolean };
  /** The team's WhatsApp, when there's one. */
  helpUrl: string | null;
  instagram: { handle: string; url: string };
  logo: string;
  /** The «Asistiré» template, empty, for her card. */
  asistireImage: string;
  site: { url: string; host: string };
}

export interface NailFestEventEmailContent {
  subject: string;
  /** The body as the editor stores it (sanitized). */
  bodyHtml: string;
  /** The band under the header; none when empty. */
  band: string | null;
  /** Her page to make her «Asistiré» image; no card without one. */
  asistire: string | null;
  /** The email's banner to leave out (eventEmailFrame.ts's bannerOf): the src of the wide image it opens with. */
  banner: string | null;
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
const DASH = /^[—–-]{1,3}$/;

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

/** Pieces of one paragraph, each closing the tags it leaves open and opening again the ones it starts inside. */
function balanced(pieces: string[]): string[] {
  let carry: { name: string; tag: string }[] = [];
  return pieces.map((piece) => {
    const html = carry.map((t) => t.tag).join("") + piece;
    const stack: { name: string; tag: string }[] = [];
    for (const m of html.matchAll(/<(\/?)(strong|em|b|i|u|s|span|a)\b[^>]*>/gi)) {
      const name = m[2]!.toLowerCase();
      if (!m[1]) stack.push({ name, tag: m[0] });
      else {
        const at = stack.map((t) => t.name).lastIndexOf(name);
        if (at >= 0) stack.splice(at, 1);
      }
    }
    carry = stack;
    return html + [...stack].reverse().map((t) => `</${t.name}>`).join("");
  });
}

/** A paragraph's lines (Shift+Enter) as the paragraphs they are: one starts at a blank line, at a line that starts with
 * an emoji, and after a line that's only a dash. */
export function paragraphLines(inner: string): string[] {
  const groups: string[][] = [[]];
  for (const line of inner.split(/<br\s*\/?>/i)) {
    const current = groups[groups.length - 1]!;
    if (!textOf(line)) {
      if (current.length) groups.push([]);
      continue;
    }
    const after = current.length > 0 && (leadingEmoji(line) !== null || DASH.test(textOf(current[current.length - 1]!)));
    if (after) groups.push([line]);
    else current.push(line);
  }
  return balanced(groups.filter((g) => g.length).map((g) => g.join("<br>")));
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

const TEXT = "#2b2d33";

/** Two columns: the emoji (or nothing, for the lines under it) and its words. */
function row(emoji: string, words: string, size: number, extra = ""): string {
  return table(
    `<tr><td width="28" valign="top" style="width:28px;padding:0;font-size:${size + 1}px;line-height:1.45;">${emoji || "&nbsp;"}</td><td valign="top" style="padding:0;${sans(size, 400, TEXT, "line-height:1.55;")}">${inline(words)}</td></tr>`,
    `margin:0 0 10px;${extra}`
  );
}

type Kind = "row" | "warn" | "other";

interface Section {
  title: string | null;
  parts: string[];
}

/** Whether a block is the image the body opens with, the one to leave out. */
function isBanner(b: Block, banner: string | null): boolean {
  if (!banner) return false;
  const html = b.tag === "img" ? b.outer : b.inner;
  if (!/^(figure|img|p)$/.test(b.tag) || textOf(html.replace(/<figcaption[\s\S]*?<\/figcaption>/i, ""))) return false;
  return attr(/<img\b([^>]*)>/i.exec(html)?.[1] ?? "", "src") === banner;
}

/** Its body, ordered, in cards: what comes after each horizontal line is a card of its own. */
export function designedSections(bodyHtml: string, banner: string | null = null): Section[] {
  const sections: Section[] = [{ title: null, parts: [] }];
  // What the last line was (a row lets the next plain lines line up with it), and how many rows its card has.
  const last = { kind: "other" as Kind, rows: 0 };
  // A paragraph's lines become blocks of their own.
  const blocks = topBlocks(bodyHtml).flatMap((b) =>
    b.tag === "p" ? paragraphLines(b.inner).map((inner) => ({ ...b, inner, outer: `<p${b.attrs}>${inner}</p>` })) : [b]
  );
  const first = blocks.findIndex((b) => b.tag !== "p" || textOf(b.inner) || /<img\b/i.test(b.inner));
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (i === first && isBanner(b, banner)) continue;
    const section = sections[sections.length - 1]!;
    const faq = Boolean(section.title);
    const size = faq ? 14.5 : 15;
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
      const heading = b.tag === "h1" ? 25 : b.tag === "h2" ? 21 : 18;
      push(`<div style="margin:16px 0 10px;${display(heading, 700, INK, align(b.attrs) ? `text-align:${align(b.attrs)};` : "")}">${inline(b.inner)}</div>`);
      continue;
    }
    if (b.tag === "ul" || b.tag === "ol") {
      const items = b.inner.replace(/<li\b[^>]*>/g, `<li style="margin:0 0 6px;">`);
      push(`<${b.tag} style="margin:0 0 12px;padding-left:22px;${sans(size, 400, TEXT, "line-height:1.6;")}">${inline(items)}</${b.tag}>`);
      continue;
    }
    if (b.tag === "blockquote") {
      push(`<div style="margin:0 0 14px;padding:4px 0 4px 14px;border-left:3px solid ${PINK};${sans(size, 400, GREY, "line-height:1.6;font-style:italic;")}">${inline(b.inner)}</div>`);
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
    if (DASH.test(words)) {
      push(`<div style="height:1px;line-height:1px;font-size:0;background:${LINE};margin:16px 0;">&nbsp;</div>`);
      continue;
    }
    const lead = leadingEmoji(inner);
    if (lead) {
      if (WARNING.test(lead.emoji)) {
        // «⚠️ IMPORTANTE:» alone on its line takes the next one in its box.
        const next = blocks[i + 1];
        const nextWords = next?.tag === "p" ? textOf(next.inner) : "";
        const takesNext = textOf(lead.rest).length <= 40 && textOf(lead.rest).endsWith(":") && nextWords && !leadingEmoji(next!.inner) && !nextWords.endsWith(":");
        const more = takesNext ? row("", next!.inner, size) : "";
        if (takesNext) i++;
        push(table(`<tr><td style="padding:12px 14px 2px;">${row(lead.emoji, lead.rest, size)}${more}</td></tr>`, `margin:6px 0 14px;background:${PEACH_SOFT};border:1px solid #ffd9c6;border-radius:14px;`), "warn");
      } else {
        // In a titled card, its rows apart by a thin line — questions and their answers.
        const apart = faq && last.rows > 0 ? `border-top:1px solid ${MINT_LINE};padding-top:12px;` : "";
        push(row(lead.emoji, lead.rest, size, apart), "row");
        last.rows++;
      }
      continue;
    }
    // As it's written (2026-10-30, the team: no capitals it didn't type).
    if (words.length <= 70 && words.endsWith(":")) {
      push(`<div style="margin:18px 0 8px;${sans(15.5, 700, TEAL_DEEP, "line-height:1.4;")}">${esc(words)}</div>`);
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
    if (last.kind === "row") {
      push(row("", inner, faq ? 14 : size), "row");
      continue;
    }
    const a = align(b.attrs);
    push(`<p style="margin:0 0 12px;${sans(size, 400, TEXT, `line-height:1.6;${a ? `text-align:${a};` : ""}`)}">${inline(inner)}</p>`);
  }
  return sections.filter((s) => s.parts.length || s.title);
}

/** A card on the page, 12px from its sides. */
const card = (inner: string, look: string, padding = "22px 20px 12px") =>
  `<tr><td style="padding:14px 12px 0;">${table(`<tr><td style="padding:${padding};">${inner}</td></tr>`, `${look}border-radius:18px;`)}</td></tr>`;

export function nailFestEventEmail(frame: NailFestEventEmailFrame, mail: NailFestEventEmailContent): { subject: string; text: string; html: string } {
  const sections = designedSections(mail.bodyHtml, mail.banner);
  const preheader = textOf(mail.bodyHtml).slice(0, 110);
  const cards = (list: Section[]) =>
    list
      .map((s) =>
        s.title
          ? card(`<div style="margin:0 0 12px;${display(20)}">${esc(s.title)}</div>${s.parts.join("")}`, `background:${MINT};border:1px solid ${MINT_LINE};`, "20px 18px 10px")
          : card(s.parts.join(""), "background:#ffffff;")
      )
      .join("");
  // Its message, then her «Asistiré» and the colleague; its doubts (its first titled card) and what follows, after them.
  // No note on her PDF, which goes all the same when the email attaches it (the team, 2026-10-30).
  const doubts = sections.findIndex((s) => s.title);
  const message = doubts < 0 ? sections : sections.slice(0, doubts);
  const rest = doubts < 0 ? [] : sections.slice(doubts);
  const asistire = mail.asistire
    ? card(
        `<div style="text-align:center;">
<div style="${display(21)}">¡Cuéntale a todos que vas!</div>
<div style="margin:8px auto 14px;max-width:400px;${sans(14.5, 400, GREY, "line-height:1.55;")}">Sube una foto tuya y te armamos tu imagen «Asistiré» para historias y publicaciones.</div>
<a href="${esc(mail.asistire)}" style="display:block;text-decoration:none;"><img src="${esc(frame.asistireImage)}" width="120" alt="Tu imagen «¡Asistiré!»" style="display:block;margin:0 auto 14px;width:120px;height:auto;border:0;border-radius:12px;"></a>
${button(mail.asistire, "Crear mi imagen")}
</div>`,
        `background:${PEACH_SOFT};`,
        "22px 18px 22px"
      )
    : "";
  const colega = card(
    `<div style="text-align:center;">
<div style="${display(21, 700, "#ffffff")}">¿Vas con una colega?</div>
<div style="margin:8px auto 14px;max-width:400px;${sans(14.5, 400, MINT_TEXT, "line-height:1.55;")}">${frame.share.free ? "La entrada es gratis: compártele el enlace para que se inscriba y tenga la suya." : "Compártele el enlace para que se inscriba y tenga la suya."}</div>
${button(frame.share.url, "Compartir por WhatsApp", `background:#ffffff;color:${TEAL_INK};`)}
</div>`,
    `background:${TEAL_DEEP};`,
    "22px 18px 22px"
  );

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(mail.subject)}</title>
${FONTS}
<style>
body{margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;}
a{color:inherit;}
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};">${esc(preheader)}</div>
${table(
  `<tr><td align="center" style="padding:16px 6px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${BG};border-radius:20px;overflow:hidden;border-collapse:separate;">
<tr><td align="center" style="padding:24px 18px 20px;background:${BG};">
<img src="${esc(frame.logo)}" width="110" alt="Nail Fest" style="display:block;margin:0 auto;width:110px;height:auto;border:0;">
${cityHeading(frame.city, frame.cityLettering)}
<div style="margin-top:8px;${sans(14, 700, INK, "line-height:1.45;")}">${esc(frame.dates)}${frame.venue ? `<br><span style="font-weight:500;color:${GREY};">${esc(frame.venue)}</span>` : ""}</div>
</td></tr>
${mail.band?.trim() ? band(esc(mail.band.trim())) : ""}
${cards(message)}
${asistire}
${colega}
${cards(rest)}
<tr><td align="center" style="padding:24px 20px 26px;${sans(13, 400, GREY, "line-height:1.7;")}">
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
    ...(mail.asistire ? [`¡CUÉNTALE A TODOS QUE VAS!\nSube una foto tuya y te armamos tu imagen «Asistiré»: ${mail.asistire}`] : []),
    `¿VAS CON UNA COLEGA?\nCompártele el enlace para que se inscriba: ${frame.share.url}`,
    ...(frame.helpUrl ? [`¿Dudas? Escríbenos por WhatsApp: ${frame.helpUrl}`] : []),
    `Síguenos en ${frame.instagram.handle} · ${frame.site.host}\nRecibes este correo porque te inscribiste a ${frame.eventName}.`,
  ].join("\n\n");

  return { subject: mail.subject, text, html };
}
