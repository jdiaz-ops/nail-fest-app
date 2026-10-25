import { INSTAGRAM_HANDLE, INSTAGRAM_URL } from "@/lib/brand";
import { MESA_COMMUNITY, MESA_SECTIONS, NAME_TOKEN, contentOf, type MesaPieceSection } from "./sections";

// La Mesa's email (2026-10-25), as in the approved template: the masthead,
// the hello with the edition's intro, what's on the table, then the section
// to play with, El termómetro (last time's results and this time's
// question), the one for the trade and El Consultorio when it's public; the
// doors and the legal line close it. Built from one frozen edition
// (MesaEditionSnapshot, lib/mesa/sends.ts) and one person; tables and inline
// styles, so it reads the same in Gmail, Outlook and the phone's mail app.
// Nothing here touches the database.

export interface MesaSnapshotPiece {
  id: string;
  section: MesaPieceSection;
  content: unknown;
}

/** El termómetro of the last edition that went out, with its votes. */
export interface MesaTermometroResults {
  pieceId: string;
  edition: number;
  question: string;
  options: string[];
  /** Per option, in the options' order. */
  votes: number[];
  total: number;
  /** The cities with enough votes to say something. */
  byCity: { key: string; label: string; votes: number[]; total: number }[];
}

export interface MesaConsultorioBlock {
  /** The most commented question of these two weeks, with its best answer. */
  featured: { slug: string; title: string; answers: number; answer: { author: string; city: string | null; body: string } | null } | null;
  /** Questions with few answers, for her to answer. */
  waiting: { slug: string; title: string; author: string; city: string | null; answers: number }[];
}

export interface MesaEditionSnapshot {
  edition: number;
  /** "jueves 5 de noviembre" */
  date: string;
  /** "jue 5 nov" */
  dateShort: string;
  /** May carry «{nombre}». */
  subject: string;
  preheader: string;
  intro: string;
  /** In the email's order: the one to play with, El termómetro, the one for the trade. */
  pieces: MesaSnapshotPiece[];
  /** Last time's termómetro; null when there's nothing to show. */
  results: MesaTermometroResults | null;
  /** No termómetro went out before this one. */
  firstTermometro: boolean;
  /** Only when the Consultorio is public. */
  consultorio: MesaConsultorioBlock | null;
  /** The doors at the bottom: only the public ones. */
  doors: { consultorio: boolean; instructoras: boolean; cuponera: boolean };
  /** A reply reaches the team (a Reply-To is set). */
  replies: boolean;
}

export interface MesaRecipient {
  firstName: string | null;
  city: string | null;
  /** Where a tap on an option goes: a signed link per person (a preview's records nothing). */
  voteUrl: (pieceId: string, option: number) => string;
  /** Null in a test: the button shows but goes nowhere. */
  unsubscribeUrl: string | null;
}

export interface MesaEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

// ── Words ───────────────────────────────────────────────────────────────────

/** A first name as it's said: its first word, capitalized; "" when it doesn't look like one. */
export function sayName(raw: string | null | undefined): string {
  const word = (raw ?? "").trim().split(/\s+/)[0] ?? "";
  if (/[\d@]/.test(word)) return "";
  const clean = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
  if (!clean || clean.length > 24) return "";
  return clean.charAt(0).toLocaleUpperCase("es") + clean.slice(1).toLocaleLowerCase("es");
}

function capitalize(text: string): string {
  const at = text.search(/\p{L}/u);
  return at < 0 ? text : text.slice(0, at) + text.charAt(at).toLocaleUpperCase("es") + text.slice(at + 1);
}

/** «{nombre}» becomes her name; without one it leaves with its comma, and a sentence it opened still starts in capitals. */
export function personalize(text: string, name: string): string {
  if (!text.includes(NAME_TOKEN)) return text;
  if (name) return text.split(NAME_TOKEN).join(name);
  const opening = /^\s*\{nombre\}\s*[,:]?\s*/;
  const opened = opening.test(text);
  const out = text
    .replace(opening, "")
    .replace(/\s*,\s*\{nombre\}/g, "")
    .replace(/\s*\{nombre\}/g, "")
    .trim();
  return opened ? capitalize(out) : out;
}

/** Whole percentages that add up to 100 (largest remainder). */
export function percentages(votes: number[]): number[] {
  const total = votes.reduce((sum, v) => sum + v, 0);
  if (total === 0) return votes.map(() => 0);
  const exact = votes.map((v) => (v / total) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((sum, v) => sum + v, 0);
  const order = exact.map((v, i) => ({ i, rest: v - Math.floor(v) })).sort((a, b) => b.rest - a.rest);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out;
}

/** "Casi la mitad", "2 de cada 3"… and whether the verb goes in plural. */
export function shareWords(pct: number): { words: string; plural: boolean } {
  if (pct >= 75) return { words: "3 de cada 4", plural: true };
  if (pct >= 66) return { words: "2 de cada 3", plural: true };
  if (pct > 50) return { words: "Más de la mitad", plural: false };
  if (pct === 50) return { words: "La mitad", plural: false };
  if (pct >= 45) return { words: "Casi la mitad", plural: false };
  if (pct >= 33) return { words: "1 de cada 3", plural: false };
  if (pct >= 25) return { words: "1 de cada 4", plural: false };
  return { words: `El ${pct}%`, plural: false };
}

/** The sentence under the bars: the answer most gave, or the tie. */
export function resultsSentence(options: string[], votes: number[]): string {
  const pcts = percentages(votes);
  const ranked = votes.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.v === 0) return "";
  if (second && second.v === top.v) {
    const tied = ranked.filter((r) => r.v === top.v).map((r) => `«${options[r.i]}»`);
    return `Quedó empatado entre ${tied.slice(0, -1).join(", ")} y ${tied[tied.length - 1]}.`;
  }
  const { words, plural } = shareWords(pcts[top.i]!);
  return `${words} ${plural ? "respondieron" : "respondió"} «${options[top.i]}».`;
}

const votedLine = (total: number) => (total === 1 ? "Votó 1 persona de la comunidad." : `Votaron ${total.toLocaleString("es-CO")} personas de la comunidad.`);

/** Accents and capitals don't make another city. */
export function cityKey(city: string | null | undefined): string {
  return (city ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Her city's line, when it has enough votes. */
export function cityLine(results: MesaTermometroResults, city: string | null): string | null {
  const key = cityKey(city);
  const mine = key ? results.byCity.find((c) => c.key === key) : undefined;
  if (!mine || mine.total === 0) return null;
  const pcts = percentages(mine.votes);
  const top = mine.votes.indexOf(Math.max(...mine.votes));
  return `En ${mine.label}, la más votada fue «${results.options[top]}» (${pcts[top]}%).`;
}

// ── HTML pieces ─────────────────────────────────────────────────────────────

const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const INK = "#17181c";
const BODY = "#33363d";
const MUTED = "#5b5f6b";

/** Each section's colors, as in the template. */
const LOOK: Record<MesaPieceSection | "CONSULTORIO", { color: string; bg: string; deep: string; dark: boolean }> = {
  MITO: { color: MESA_SECTIONS.MITO.color, bg: MESA_SECTIONS.MITO.color, deep: "#c2412f", dark: true },
  PALABRA: { color: MESA_SECTIONS.PALABRA.color, bg: "#e3f6f3", deep: "#0b5c57", dark: false },
  SABIAS: { color: MESA_SECTIONS.SABIAS.color, bg: "#efeafd", deep: "#5137a8", dark: false },
  TRUCO: { color: MESA_SECTIONS.TRUCO.color, bg: "#e4ecfb", deep: "#22479b", dark: false },
  PORQUE: { color: MESA_SECTIONS.PORQUE.color, bg: MESA_SECTIONS.PORQUE.color, deep: "#17204d", dark: true },
  TERMOMETRO: { color: MESA_SECTIONS.TERMOMETRO.color, bg: "#fff4d6", deep: "#8a5d00", dark: false },
  CONSULTORIO: { color: MESA_COMMUNITY.consultorio.color, bg: "#fdebe2", deep: "#b0532f", dark: false },
};

const NAMES: Record<MesaPieceSection | "CONSULTORIO", string> = {
  MITO: MESA_SECTIONS.MITO.name,
  PALABRA: MESA_SECTIONS.PALABRA.name,
  SABIAS: MESA_SECTIONS.SABIAS.name,
  TRUCO: MESA_SECTIONS.TRUCO.name,
  PORQUE: MESA_SECTIONS.PORQUE.name,
  TERMOMETRO: MESA_SECTIONS.TERMOMETRO.name,
  CONSULTORIO: MESA_COMMUNITY.consultorio.name,
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const table = (inner: string, style = "") =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;
const font = (size: number, weight = 400, color = INK, extra = "") =>
  `font-family:${SANS};font-size:${size}px;font-weight:${weight};color:${color};${extra}`;
const display = (size: number, color = INK, extra = "") =>
  `font-family:${SERIF};font-size:${size}px;font-weight:900;line-height:1.1;letter-spacing:-0.01em;color:${color};${extra}`;
const nailShape = (color: string, w: number, h: number, extra = "") =>
  `<span style="display:inline-block;width:${w}px;height:${h}px;background:${color};border-radius:${Math.round(w / 2)}px ${Math.round(w / 2)}px ${Math.max(3, Math.round(w / 4))}px ${Math.max(3, Math.round(w / 4))}px;${extra}"></span>`;

function label(n: number, key: MesaPieceSection | "CONSULTORIO"): string {
  const look = LOOK[key];
  const chip = look.dark ? "#ffffff" : look.color;
  const number = look.dark ? look.color : "#ffffff";
  const text = look.dark ? "#ffffff" : look.color;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr>
<td width="24" height="30" align="center" valign="middle" style="width:24px;height:30px;background:${chip};border-radius:12px 12px 7px 7px;${font(12, 800, number, "line-height:30px;")}">${n}</td>
<td style="padding-left:10px;${font(12, 800, text, "letter-spacing:0.12em;text-transform:uppercase;")}">${esc(NAMES[key])}</td>
</tr></table>`;
}

/** Big tappable answers, side by side (two or three) or two by two (four). */
function choices(items: { label: string; href: string }[], style: { bg: string; ink: string; border: string; size: number }): string {
  const perRow = items.length === 4 ? 2 : items.length;
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += perRow) {
    const cells = items.slice(i, i + perRow).map((item, j, row) => {
      const pad = row.length === 1 ? "" : j === 0 ? "padding-right:5px;" : j === row.length - 1 ? "padding-left:5px;" : "padding:0 5px;";
      return `<td width="${Math.floor(100 / row.length)}%" valign="top" style="${pad}padding-bottom:10px;"><a href="${esc(item.href)}" style="display:block;text-decoration:none;text-align:center;padding:14px 6px;border:${style.border};border-radius:14px;background:${style.bg};${font(style.size, 800, style.ink, "line-height:1.25;")}">${esc(item.label)}</a></td>`;
    });
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return table(rows.join(""));
}

function bar(option: string, pct: number, top: boolean): string {
  const fill = top ? LOOK.TERMOMETRO.color : "#f4c94e";
  const track =
    pct <= 0
      ? `<td style="height:12px;font-size:0;line-height:0;">&nbsp;</td>`
      : pct >= 100
        ? `<td style="height:12px;background:${fill};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>`
        : `<td width="${pct}%" style="height:12px;background:${fill};border-radius:999px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td>`;
  return table(
    `<tr><td style="padding:0 0 6px;${font(14.5, 700)}">${esc(option)}</td><td align="right" style="padding:0 0 6px;${font(14.5, 800, LOOK.TERMOMETRO.deep)}">${pct}%</td></tr>
<tr><td colspan="2">${table(`<tr>${track}</tr>`, "background:#ffffff;border-radius:999px;")}</td></tr>`,
    "margin:0 0 12px;",
  );
}

function section(key: MesaPieceSection | "CONSULTORIO", n: number, inner: string): string {
  const look = LOOK[key];
  return `<tr><td class="px" style="padding:28px;background:${look.bg};">${label(n, key)}${inner}</td></tr>`;
}

// ── The email ───────────────────────────────────────────────────────────────

const HINTS: Record<MesaPieceSection | "CONSULTORIO", string> = {
  MITO: "vota",
  PALABRA: "1 palabra",
  SABIAS: "1 dato",
  TERMOMETRO: "1 toque",
  TRUCO: "1 truco",
  PORQUE: "3 pasos",
  CONSULTORIO: "responde",
};

const LEGAL = "llega cada 15 días, el jueves, a la comunidad de Nail Fest. Te llega porque te registraste en Nail Fest y aceptaste recibir novedades.";
const SIGNATURE = "— El equipo de Nail Fest";

export function mesaEmail(snapshot: MesaEditionSnapshot, to: MesaRecipient, opts: { baseUrl: string }): MesaEmail {
  const name = sayName(to.firstName);
  const city = (to.city ?? "").trim();
  const subject = personalize(snapshot.subject, name);
  const intro = personalize(snapshot.intro, name);
  const campaign = `la-mesa-${snapshot.edition}`;
  /** A page of the site, tagged as coming from this edition. */
  const site = (path: string) => {
    const url = new URL(path, opts.baseUrl);
    url.searchParams.set("utm_source", "email");
    url.searchParams.set("utm_medium", "la_mesa");
    url.searchParams.set("utm_campaign", campaign);
    return url.toString();
  };
  const host = new URL(opts.baseUrl).host.replace(/^www\./, "");

  const html: string[] = [];
  const text: string[] = [];
  const keys: (MesaPieceSection | "CONSULTORIO")[] = [...snapshot.pieces.map((p) => p.section), ...(snapshot.consultorio ? (["CONSULTORIO"] as const) : [])];

  // Each section, numbered as it comes.
  snapshot.pieces.forEach((piece, index) => {
    const n = index + 1;
    const look = LOOK[piece.section];
    switch (piece.section) {
      case "MITO": {
        const c = contentOf("MITO", piece.content);
        if (!c) return;
        html.push(
          section(
            "MITO",
            n,
            `<div style="${display(29, "#ffffff", "margin:4px 0 18px;line-height:1.08;")}">«${esc(c.statement)}»</div>
${choices(
  [
    { label: "Mito", href: to.voteUrl(piece.id, 0) },
    { label: "Verdad", href: to.voteUrl(piece.id, 1) },
  ],
  { bg: "#ffffff", ink: INK, border: "0", size: 17 },
)}
<div style="${font(13, 400, "#ffe9e4", "line-height:1.45;")}">Toca tu respuesta: la explicación se abre al instante.</div>`,
          ),
        );
        text.push(`${n}. MITO O VERDAD\n«${c.statement}»\nMito: ${to.voteUrl(piece.id, 0)}\nVerdad: ${to.voteUrl(piece.id, 1)}`);
        return;
      }
      case "PALABRA": {
        const c = contentOf("PALABRA", piece.content);
        if (!c) return;
        html.push(
          section(
            "PALABRA",
            n,
            `<div style="margin:2px 0 6px;"><span style="${display(44, look.deep, "line-height:1;")}">${esc(c.word)}</span>&nbsp;&nbsp;<span style="${font(15, 400, "#4b6b68", "font-style:italic;")}">${esc(c.kind)}</span></div>
<div style="${font(17, 400, INK, "line-height:1.55;margin:8px 0 14px;")}">${esc(c.definition)}</div>
${table(`<tr><td style="padding:14px 16px;background:#ffffff;border-left:4px solid ${look.color};border-radius:4px 14px 14px 4px;${font(15, 400, INK, "line-height:1.5;")}"><div style="${font(12, 800, look.color, "letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px;")}">Úsala así</div>«${esc(c.example)}»</td></tr>`)}`,
          ),
        );
        text.push(`${n}. LA PALABRA\n${c.word} (${c.kind})\n${c.definition}\nÚsala así: «${c.example}»`);
        return;
      }
      case "SABIAS": {
        const c = contentOf("SABIAS", piece.content);
        if (!c) return;
        html.push(section("SABIAS", n, `<div style="${display(24, INK, "margin:0 0 12px;line-height:1.15;")}">${esc(c.fact)}</div><div style="${font(15.5, 400, BODY, "line-height:1.6;")}">${esc(c.detail)}</div>`));
        text.push(`${n}. ¿SABÍAS QUE…?\n${c.fact}\n${c.detail}`);
        return;
      }
      case "TRUCO": {
        const c = contentOf("TRUCO", piece.content);
        if (!c) return;
        html.push(
          section(
            "TRUCO",
            n,
            `<div style="${display(26, INK, "margin:0 0 12px;")}">${esc(c.title)}</div>
<div style="${font(15.5, 400, BODY, "line-height:1.6;")}">${esc(c.trick)}</div>
${table(`<tr><td style="padding:12px 14px;background:#ffffff;border-radius:14px;${font(14, 400, INK, "line-height:1.4;")}"><span style="color:${look.color};">&#9733;</span>&nbsp; ¿Te sirvió? Síguenos en Instagram: <a href="${INSTAGRAM_URL}" style="color:${look.deep};font-weight:700;text-decoration:underline;">${INSTAGRAM_HANDLE}</a></td></tr>`, "margin-top:14px;")}`,
          ),
        );
        text.push(`${n}. EL TRUCO\n${c.title}\n${c.trick}`);
        return;
      }
      case "PORQUE": {
        const c = contentOf("PORQUE", piece.content);
        if (!c) return;
        const heading = (t: string) => `<div style="${font(12.5, 800, "#aeb8f0", "letter-spacing:0.12em;text-transform:uppercase;margin:16px 0 8px;")}">${t}</div>`;
        const steps = c.steps
          .map(
            (step, i) =>
              `<tr><td style="padding:0 0 8px;">${table(
                `<tr><td width="24" valign="top" style="padding:10px 0 10px 12px;"><div style="width:24px;height:24px;border-radius:12px;background:#ffffff;text-align:center;${font(13, 800, look.color, "line-height:24px;")}">${i + 1}</div></td><td style="padding:10px 12px;${font(15, 400, "#ffffff", "line-height:1.5;")}">${esc(step)}</td></tr>`,
                "background:#3c477d;border-radius:12px;",
              )}</td></tr>`,
          )
          .join("");
        html.push(
          section(
            "PORQUE",
            n,
            `<div style="${display(26, "#ffffff", "margin:0;")}">${esc(c.question)}</div>
${heading("Las causas")}<ul style="margin:0;padding-left:20px;${font(15.5, 400, "#e8ebf7", "line-height:1.55;")}">${c.causes.map((cause) => `<li style="margin-bottom:4px;">${esc(cause)}</li>`).join("")}</ul>
${heading("Cómo evitarlo")}${table(steps)}`,
          ),
        );
        text.push(`${n}. ¿POR QUÉ PASÓ?\n${c.question}\nLas causas:\n${c.causes.map((x) => `- ${x}`).join("\n")}\nCómo evitarlo:\n${c.steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}`);
        return;
      }
      case "TERMOMETRO": {
        const c = contentOf("TERMOMETRO", piece.content);
        if (!c) return;
        const parts: string[] = [];
        const lines: string[] = [];
        const results = snapshot.results && snapshot.results.total > 0 ? snapshot.results : null;
        if (results) {
          const pcts = percentages(results.votes);
          const top = Math.max(...results.votes);
          const when = results.edition === snapshot.edition - 1 ? "La quincena pasada" : "La última vez";
          parts.push(`<div style="${font(17, 400, INK, "line-height:1.4;margin:0 0 14px;")}">${when} te preguntamos: <b>${esc(results.question)}</b></div>`);
          results.options.forEach((option, i) => parts.push(bar(option, pcts[i]!, results.votes[i] === top)));
          const mine = cityLine(results, city);
          parts.push(
            table(
              `<tr><td style="padding:14px 16px;background:#ffffff;border-radius:14px;${font(15, 400, INK, "line-height:1.55;")}">${esc(resultsSentence(results.options, results.votes))}${mine ? ` ${esc(mine)}` : ""} <b style="color:${look.deep};">${esc(votedLine(results.total))}</b></td></tr>`,
              "margin:14px 0 22px;",
            ),
          );
          lines.push(`${when} te preguntamos: ${results.question}`);
          results.options.forEach((option, i) => lines.push(`- ${option}: ${pcts[i]}%`));
          lines.push(`${resultsSentence(results.options, results.votes)}${mine ? ` ${mine}` : ""} ${votedLine(results.total)}`);
        }
        if (snapshot.firstTermometro) {
          parts.push(`<span style="display:inline-block;margin-bottom:10px;padding:4px 10px;border-radius:999px;background:#ffffff;${font(12, 800, look.deep, "letter-spacing:0.04em;text-transform:uppercase;")}">La primera encuesta de La Mesa</span>`);
        }
        parts.push(`<div style="${display(results ? 22 : 24, INK, "margin:0 0 14px;line-height:1.15;")}">${results ? "Esta quincena: " : ""}${esc(c.question)}</div>`);
        parts.push(choices(c.options.map((option, i) => ({ label: option, href: to.voteUrl(piece.id, i) })), { bg: "#ffffff", ink: INK, border: `2px solid ${INK}`, size: 14.5 }));
        parts.push(
          `<div style="${font(13, 400, "#6c6f78", "line-height:1.45;")}">${
            snapshot.firstTermometro ? "Un toque y listo. En la próxima Mesa ves lo que respondieron las demás, también en tu ciudad." : "Un toque y listo. Los resultados, en la próxima Mesa."
          }</div>`,
        );
        html.push(section("TERMOMETRO", n, parts.join("\n")));
        lines.push(`${results ? "Esta quincena: " : ""}${c.question}`);
        c.options.forEach((option, i) => lines.push(`${option}: ${to.voteUrl(piece.id, i)}`));
        text.push(`${n}. EL TERMÓMETRO\n${lines.join("\n")}`);
        return;
      }
    }
  });

  if (snapshot.consultorio) {
    const n = snapshot.pieces.length + 1;
    const look = LOOK.CONSULTORIO;
    const { featured, waiting } = snapshot.consultorio;
    const parts: string[] = [];
    const lines: string[] = [];
    if (featured) {
      const answer = featured.answer
        ? table(
            `<tr><td style="padding:12px 14px;background:#fff6f1;border-left:4px solid ${look.color};border-radius:4px 12px 12px 4px;${font(15, 400, INK, "line-height:1.5;")}"><div style="${font(13.5, 700)}">${esc(featured.answer.author)}${featured.answer.city ? ` <span style="font-weight:600;color:#6c6f78;">· ${esc(featured.answer.city)}</span>` : ""}</div>${esc(featured.answer.body)}</td></tr>`,
          )
        : "";
      parts.push(
        table(
          `<tr><td style="padding:16px 18px;background:#ffffff;border-radius:18px;">
${table(`<tr><td style="${font(13, 700, "#6c6f78")}">La pregunta más comentada</td><td align="right" style="${font(13, 700, "#6c6f78")}">${featured.answers === 1 ? "1 respuesta" : `${featured.answers} respuestas`}</td></tr>`)}
<div style="margin:8px 0 14px;"><a href="${esc(site(`/consultorio/${featured.slug}`))}" style="text-decoration:none;${font(19, 700, INK, "line-height:1.3;")}">«${esc(featured.title)}»</a></div>
${answer}
</td></tr>`,
        ),
      );
      lines.push(`La pregunta más comentada: «${featured.title}» ${site(`/consultorio/${featured.slug}`)}`);
      if (featured.answer) lines.push(`${featured.answer.author}${featured.answer.city ? ` · ${featured.answer.city}` : ""}: ${featured.answer.body}`);
    }
    if (waiting.length > 0) {
      parts.push(`<div style="${font(12.5, 800, look.deep, "letter-spacing:0.12em;text-transform:uppercase;margin:20px 0 6px;")}">Esperan tu respuesta</div>`);
      for (const q of waiting) {
        const who = [q.author, q.city, q.answers === 0 ? "sin respuestas" : q.answers === 1 ? "1 respuesta" : `${q.answers} respuestas`].filter(Boolean).join(" · ");
        parts.push(
          table(
            `<tr><td style="padding:12px 0;border-bottom:1px solid #f3d8cb;"><div style="${font(15, 700, INK, "line-height:1.35;")}">${esc(q.title)}</div><div style="${font(12.5, 400, "#6c6f78")}">${esc(who)}</div></td>
<td width="1%" align="right" style="padding:12px 0 12px 12px;border-bottom:1px solid #f3d8cb;white-space:nowrap;"><a href="${esc(site(`/consultorio/${q.slug}`))}" style="display:inline-block;padding:9px 14px;border:2px solid ${INK};border-radius:999px;background:#ffffff;text-decoration:none;${font(13.5, 800)}">Responder</a></td></tr>`,
          ),
        );
        lines.push(`Espera tu respuesta: ${q.title} ${site(`/consultorio/${q.slug}`)}`);
      }
    }
    if (!featured && waiting.length === 0) {
      parts.push(`<div style="${font(15.5, 400, BODY, "line-height:1.6;")}">¿Tienes una duda del oficio? Pregúntale a la comunidad: responden colegas e instructoras.</div>`);
    }
    parts.push(
      `<div style="margin-top:18px;"><a href="${esc(site("/consultorio/preguntar"))}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:${look.color};text-decoration:none;${font(15, 800, "#ffffff")}">Haz tu pregunta</a></div>`,
    );
    lines.push(`Haz tu pregunta: ${site("/consultorio/preguntar")}`);
    html.push(section("CONSULTORIO", n, parts.join("\n")));
    text.push(`${n}. EL CONSULTORIO\n${lines.join("\n")}`);
  }

  // ── Around the sections ──
  const hasResults = Boolean(snapshot.results && snapshot.results.total > 0);
  const toc = keys
    .map(
      (key) =>
        `<tr><td width="20" style="padding:4px 0;">${nailShape(LOOK[key].color, 10, 13)}</td><td style="padding:4px 0;${font(15, 700)}">${esc(NAMES[key])}</td><td align="right" style="padding:4px 0;${font(12.5, 600, "#8a8478")}">${
          key === "TERMOMETRO" && hasResults ? "resultados" : HINTS[key]
        }</td></tr>`,
    )
    .join("");
  const forWho = [name ? `Para ${name}` : "Para ti", city].filter(Boolean).join(" · ");
  const words = text.join(" ").split(/\s+/).length + intro.split(/\s+/).length;
  const minutes = Math.max(2, Math.ceil(words / 200));

  const doors = [
    snapshot.doors.consultorio ? { label: "Consultorio", href: site("/consultorio") } : null,
    snapshot.doors.instructoras ? { label: "Instructoras", href: site("/instructoras") } : null,
    snapshot.doors.cuponera ? { label: "Cuponera", href: site("/cuponera") } : null,
  ].filter((d): d is { label: string; href: string } => d !== null);

  const preheaderFill = "&#847;&zwnj;&nbsp;".repeat(60);
  const document = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,900&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;padding:0;background:#f1ede7;-webkit-text-size-adjust:100%;}
a{color:inherit;}
@media (max-width:620px){.px{padding-left:20px!important;padding-right:20px!important;}.mast{font-size:60px!important;}}
</style>
</head>
<body style="margin:0;padding:0;background:#f1ede7;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#f1ede7;">${esc(snapshot.preheader)}${preheaderFill}</div>
${table(
  `<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border-collapse:separate;">
<tr><td class="px" style="padding:24px 28px 22px;background:#fbf6f1;">
${table(`<tr><td><img src="${esc(new URL("/logo.png", opts.baseUrl).toString())}" width="38" height="30" alt="Nail Fest" style="display:block;border:0;width:38px;height:30px;"></td><td align="right" style="${font(12, 800, MUTED, "letter-spacing:0.08em;text-transform:uppercase;")}">Edición ${snapshot.edition} · ${esc(snapshot.dateShort)}</td></tr>`)}
<div class="mast" style="${display(72, INK, "margin:14px 0 0;line-height:0.9;letter-spacing:-0.035em;")}">La Mesa</div>
<div style="${font(16, 400, BODY, "line-height:1.45;margin:12px 0 16px;")}">Lo que pasa en el mundo de las uñas, servido cada 15 días.</div>
<div style="font-size:0;line-height:0;">${keys.map((key) => nailShape(LOOK[key].color, 30, 40, "margin-right:8px;")).join("")}</div>
${table(`<tr><td style="padding-top:14px;${font(13, 700, MUTED)}">${esc(forWho)}</td><td align="right" style="padding-top:14px;${font(13, 700, MUTED)}">${minutes} min de lectura</td></tr>`, "margin-top:16px;border-top:1px solid #eadfd3;")}
</td></tr>
<tr><td class="px" style="padding:26px 28px 4px;">
<div style="${display(30, INK, "margin:0 0 10px;")}">${name ? `Hola, ${esc(name)}.` : "Hola."}</div>
<div style="${font(16, 400, BODY, "line-height:1.6;")}">${esc(intro)}</div>
<div style="${font(14.5, 400, MUTED, "font-style:italic;margin-top:10px;")}">${SIGNATURE}</div>
</td></tr>
<tr><td class="px" style="padding:18px 28px 24px;">
${table(`<tr><td style="padding:14px 18px;"><div style="${font(12, 800, MUTED, "letter-spacing:0.12em;text-transform:uppercase;margin-bottom:6px;")}">En esta mesa</div>${table(toc)}</td></tr>`, "background:#fbf6f1;border-radius:16px;")}
</td></tr>
${html.join("\n")}
${
  snapshot.replies
    ? `<tr><td class="px" style="padding:24px 28px;background:#fbf6f1;"><div style="${font(15.5, 400, INK, "line-height:1.5;")}"><span style="color:${LOOK.PALABRA.color};">&#8617;</span>&nbsp; Responde este correo con lo que quieres ver en La Mesa: lo leemos todo.</div><div style="${font(14.5, 400, MUTED, "font-style:italic;margin-top:12px;")}">${SIGNATURE}</div></td></tr>`
    : ""
}
${
  doors.length
    ? `<tr><td style="border-top:1px solid #eeeeee;">${table(
        `<tr>${doors.map((d, i) => `<td width="${Math.floor(100 / doors.length)}%" align="center" style="padding:14px 6px;${i ? "border-left:1px solid #eeeeee;" : ""}"><a href="${esc(d.href)}" style="text-decoration:none;${font(13, 800)}">${d.label}</a></td>`).join("")}</tr>`,
      )}</td></tr>`
    : ""
}
<tr><td style="padding:18px 28px 26px;text-align:center;${font(12.5, 400, "#6c6f78", "line-height:1.6;")}">
<b style="color:${INK};">La Mesa</b> ${LEGAL}<br>
<a href="${esc(to.unsubscribeUrl ?? "#")}" style="display:inline-block;margin:12px 0;padding:10px 18px;border:1.5px solid #d9d4cc;border-radius:999px;text-decoration:none;${font(12.5, 700)}">Dejar de recibir estos correos</a><br>
<a href="${esc(site("/"))}" style="color:#6c6f78;">${esc(host)}</a>
</td></tr>
</table>
</td></tr>`,
  "background:#f1ede7;",
)}
</body>
</html>`;

  const plain = [
    `LA MESA · Edición ${snapshot.edition} · ${snapshot.date}`,
    `${name ? `Hola, ${name}.` : "Hola."}\n${intro}\n${SIGNATURE}`,
    ...text,
    snapshot.replies ? "Responde este correo con lo que quieres ver en La Mesa: lo leemos todo." : "",
    `La Mesa ${LEGAL}${to.unsubscribeUrl ? `\nDejar de recibir estos correos: ${to.unsubscribeUrl}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, preheader: snapshot.preheader, html: document, text: plain };
}
