// Auto-tags any link to the app's OWN domain inside outbound broadcast
// content with UTM parameters, at send time — so a click on a link INSIDE
// an email this app sends attributes back to "este correo", instead of
// silently landing in "orgánico" next to real organic traffic. Before
// this, the app's own campaigns and real organic interest were
// indistinguishable in Fuente/Entradas emitidas (see that page's own
// comment) — not a code bug in the UTM capture itself (lib/utm.ts reads
// whatever's in the URL faithfully), just nothing had ever put UTM
// params on the app's OWN links in the first place.
//
// Only touches links whose origin matches APP_BASE_URL — never an
// external link an admin pasted (a sponsor's site, a social profile),
// and never overwrites utm_ params a link already carries (an admin who
// hand-tagged a link on purpose keeps exactly what they typed).
//
// WhatsApp broadcasts deliberately do NOT go through this — those are
// Meta-preapproved templates, and any dynamic URL in one already uses
// Meta's own per-person URL-suffix mechanism (see
// lib/whatsapp/automations.ts's isDynamicUrlButton) for a different
// purpose (personalizing the link itself, not attribution); bolting UTM
// params onto that risks fighting that existing mechanism rather than
// complementing it. That needs its own dedicated look, not a rushed
// addition here.

function appendUtmToUrl(rawUrl: string, params: { source: string; medium: string; campaign: string }): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return rawUrl; // malformed — leave untouched rather than throw on send
  }
  if (!url.searchParams.has("utm_source")) url.searchParams.set("utm_source", params.source);
  if (!url.searchParams.has("utm_medium")) url.searchParams.set("utm_medium", params.medium);
  if (!url.searchParams.has("utm_campaign")) url.searchParams.set("utm_campaign", params.campaign);
  return url.toString();
}

function isOwnDomainUrl(rawUrl: string): boolean {
  const base = process.env.APP_BASE_URL;
  if (!base) return false;
  try {
    return new URL(rawUrl).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** A short, readable campaign value from a broadcast's own subject —
 * "¡Falta 1 semana para el Nail Fest!" -> "falta-1-semana-para-el-nail".
 * Doesn't need to be globally unique (utm_campaign is meant to be
 * human-scannable in Meta/GA, not a lookup key) — truncated so a long
 * subject doesn't produce an unwieldy query string. */
export function slugifyForCampaign(subject: string): string {
  const slug = subject
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 40) || "broadcast";
}

/** Every `href="..."` attribute pointing at the app's own domain gets
 * UTM params appended — used on the final rendered HTML right before
 * sendTransactional/sendMarketing, after merge-tag substitution and
 * sanitizeEventDescription have both already run, so this only ever
 * modifies an href value, never introduces a new tag/attribute. Handles
 * the one HTML-escaping wrinkle: a stored href with an existing query
 * string round-trips through TipTap's serializer as `&amp;`, not a bare
 * `&` — decoded before building the URL, re-escaped on the way back out
 * so the HTML stays valid. */
export function tagOwnLinksInHtml(html: string, params: { source: string; medium: string; campaign: string }): string {
  return html.replace(/href="([^"]*)"/g, (match, hrefEncoded: string) => {
    const href = hrefEncoded.replace(/&amp;/g, "&");
    if (!isOwnDomainUrl(href)) return match;
    const tagged = appendUtmToUrl(href, params).replace(/&/g, "&amp;");
    return `href="${tagged}"`;
  });
}

/** Same idea for a plain-text body — a bare URL an admin typed straight
 * into a plain-text broadcast (no `<a>` tag at all, just text most email
 * clients auto-linkify on their own). Matches anything starting with
 * APP_BASE_URL up to the next whitespace/quote/paren. */
export function tagOwnLinksInText(text: string, params: { source: string; medium: string; campaign: string }): string {
  const base = process.env.APP_BASE_URL;
  if (!base) return text;
  let escapedBase: string;
  try {
    escapedBase = new URL(base).origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  } catch {
    return text;
  }
  const re = new RegExp(`${escapedBase}[^\\s)"'<>]*`, "g");
  return text.replace(re, (match) => appendUtmToUrl(match, params));
}
