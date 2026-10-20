import { z } from "zod";

// Reads Nail Fest's catalog from Marcolini: GET /api/v1/catalogo with the
// key Marcolini gave Nail Fest's creator account. It only ever returns the
// brands that accepted Nail Fest as a creator (and that Marcolini itself is
// promoting), each with Nail Fest's code, and the products those brands have
// on sale. Read-only. Configured with MARCOLINI_API_KEY (required) and
// MARCOLINI_API_URL (defaults to https://marcolini.lat).

const DEFAULT_BASE_URL = "https://marcolini.lat";
const PAGE_SIZE = 1000;
// 50 pages of 1000 — far beyond any real catalog; stops a loop on a bad cursor.
const MAX_PAGES = 50;
const MAX_REDIRECTS = 3;

export interface MarcoliniConfig {
  baseUrl: string;
  apiKey: string;
}

function unwrap(value: string): string {
  return value.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

/** What gets pasted into Vercel, cleaned: quotes or asterisks around it,
 * the period of the sentence it was copied from, stray spaces or line
 * breaks, "MARCOLINI_API_KEY=" in front, or the whole Marcolini-side entry
 * ("nailfest:llave") instead of just the key — the key is what comes after
 * the last colon. A key starts and ends with a letter or digit; Marcolini
 * trims its own copy the same way, so the two still compare equal. */
export function cleanMarcoliniKey(raw: string | undefined): string {
  let key = (raw ?? "").trim().replace(/^MARCOLINI_API_KEY\s*=\s*/i, "").replace(/^bearer\s+/i, "");
  key = key.slice(key.lastIndexOf(":") + 1);
  return key.replace(/\s+/g, "").replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
}

/** The key's first and last characters and its length — enough to compare
 * it with Marcolini's without showing it. */
export function keyHint(apiKey: string): string {
  return `${apiKey.slice(0, 4)}…${apiKey.slice(-4)} (${apiKey.length} caracteres)`;
}

export function marcoliniConfig(): MarcoliniConfig | null {
  const apiKey = cleanMarcoliniKey(process.env.MARCOLINI_API_KEY);
  if (!apiKey) return null;
  const baseUrl = (unwrap(process.env.MARCOLINI_API_URL ?? "") || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { baseUrl, apiKey };
}

/** A failure the admin can act on — the message is shown as is in
 * /admin/cuponera. */
export class MarcoliniError extends Error {}

const httpUrl = z.string().refine((u) => /^https?:\/\/\S+$/i.test(u), "not an http(s) url");
// Marcolini's test products carry inline SVG pictures.
const pictureUrl = z.string().refine((u) => /^https?:\/\/\S+$/i.test(u) || /^data:image\/[a-z+]+;base64,/i.test(u), "not a picture url");

const campaignSchema = z.object({
  name: z.string(),
  discountPercent: z.number().nullable(),
  commissionPercent: z.number().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
});

const brandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  logoUrl: pictureUrl.nullable().catch(null),
  storeUrl: httpUrl.nullable().catch(null),
  storeKind: z.string(),
  codeAppliedByLink: z.boolean(),
  discountCode: z.string().min(1),
  discountPercent: z.number().min(0).max(100),
  commissionPercent: z.number().min(0).max(100),
  campaign: campaignSchema.nullable().catch(null),
  visibleInVitrina: z.boolean().catch(true),
  vitrinaOrder: z.number().catch(0),
});

const productSchema = z.object({
  id: z.string().min(1),
  brandId: z.string().min(1),
  name: z.string().min(1),
  imageUrl: pictureUrl.nullable().catch(null),
  price: z.number().nonnegative(),
  priceMax: z.number().nonnegative().nullable().catch(null),
  compareAtPrice: z.number().nonnegative().nullable().catch(null),
  currency: z.string().catch("COP"),
  url: httpUrl,
  category: z.string().nullable().catch(null),
  collections: z.array(z.string()).catch([]),
  type: z.string().catch("PHYSICAL"),
  createdAt: z.string().refine((d) => !Number.isNaN(Date.parse(d)), "not a date"),
});

const pageSchema = z.object({
  creator: z.object({ displayName: z.string(), storefrontSlug: z.string() }),
  brands: z.array(z.unknown()),
  products: z.array(z.unknown()),
  nextCursor: z.string().nullable(),
});

export type MarcoliniBrand = z.infer<typeof brandSchema>;
export type MarcoliniProduct = z.infer<typeof productSchema>;
export type MarcoliniCampaign = z.infer<typeof campaignSchema>;

export interface MarcoliniCatalog {
  creator: { displayName: string; storefrontSlug: string };
  brands: MarcoliniBrand[];
  products: MarcoliniProduct[];
  /** Rows dropped because they didn't parse (or weren't priced in COP). */
  skipped: number;
  /** The host that actually answered, after following redirects. */
  servedFrom: string;
}

/** marcolini.lat and www.marcolini.lat are the same site. */
function sameSite(a: URL, b: URL): boolean {
  const site = (u: URL) => u.hostname.replace(/^www\./, "");
  return site(a) === site(b);
}

/** One GET with the key. Redirects are followed by hand: fetch drops the
 * Authorization header whenever a redirect changes the host (marcolini.lat
 * → www.marcolini.lat), and Marcolini would get no key at all and answer
 * 401. The key only follows a redirect to the same site, and never from
 * https down to http. */
async function getWithKey(url: URL, config: MarcoliniConfig, fetchImpl: typeof fetch): Promise<{ res: Response; url: URL }> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await fetchImpl(current, {
        headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      const what = err instanceof Error && err.name === "TimeoutError" ? "Marcolini no respondió a tiempo" : "No se pudo conectar con Marcolini";
      throw new MarcoliniError(`${what} (${current.origin}). Vuelve a intentarlo en un rato.`);
    }
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return { res, url: current };
    const next = new URL(location, current);
    if (!sameSite(next, current) || (current.protocol === "https:" && next.protocol !== "https:")) {
      throw new MarcoliniError(
        `${current.host} redirige a ${next.origin}, que no es el mismo sitio: no le mando la llave allá. Si esa es la dirección de Marcolini, ponla en MARCOLINI_API_URL.`,
      );
    }
    current = next;
  }
  throw new MarcoliniError(`${url.host} redirige demasiadas veces. Revisa MARCOLINI_API_URL.`);
}

async function errorMessage(res: Response, config: MarcoliniConfig): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown; reason?: unknown; keyLengths?: unknown } | null;
  const reason = typeof body?.error === "string" ? body.error : null;
  switch (res.status) {
    case 401:
      // Marcolini says which side is wrong (see its /api/v1/catalogo); no
      // JSON at all means the address isn't Marcolini's catalog.
      if (body?.reason === "missing_key") {
        return "A Marcolini no le llegó la llave: se pierde en el camino. Pon en MARCOLINI_API_URL la dirección exacta donde responde Marcolini (por ejemplo https://www.marcolini.lat).";
      }
      if (body?.reason === "no_keys") {
        return "Marcolini todavía no tiene la llave: en Vercel, proyecto de Marcolini, revisa que CATALOG_API_KEYS exista para Production con el formato nailfest:llave, y vuelve a desplegar Marcolini.";
      }
      if (body?.reason === "mismatch") {
        const lengths = Array.isArray(body.keyLengths) ? body.keyLengths.filter((n): n is number => typeof n === "number") : [];
        const ours = config.apiKey.length;
        const ends = `${config.apiKey.slice(0, 4)}…${config.apiKey.slice(-4)}`;
        if (lengths.length === 0) return `La llave de Nail Fest (${ends}, ${ours} caracteres) no coincide con la de Marcolini.`;
        if (lengths.includes(ours)) {
          return `Las dos llaves tienen ${ours} caracteres pero son distintas (la de Nail Fest es ${ends}). Copia la misma llave otra vez en los dos proyectos de Vercel: después de «nailfest:» en CATALOG_API_KEYS (Marcolini) y en MARCOLINI_API_KEY (Nail Fest).`;
        }
        // A key from `openssl rand -hex 32` has 64 characters: the side that
        // doesn't is the one to fix.
        const fix =
          ours === 64
            ? "Revisa CATALOG_API_KEYS en el proyecto de Marcolini."
            : lengths.includes(64)
              ? "Revisa MARCOLINI_API_KEY en el proyecto de Nail Fest."
              : "Revisa la llave en los dos proyectos.";
        return `La llave de Marcolini tiene ${lengths.join(" o ")} caracteres y la de Nail Fest ${ours} (${ends}): a una de las dos le sobra o le falta algo. ${fix}`;
      }
      if (!body) {
        return `${config.baseUrl} respondió «no autorizado» sin ser el catálogo de Marcolini. Revisa MARCOLINI_API_URL (o bórrala para usar https://marcolini.lat).`;
      }
      return "Marcolini no reconoce la llave. Revisa que MARCOLINI_API_KEY en Vercel sea la misma llave que tiene Marcolini.";
    case 403:
      return reason ?? "Marcolini rechazó la conexión: la cuenta de creadora de Nail Fest está suspendida.";
    case 404:
      // A JSON 404 is Marcolini saying the key points to no creator; an
      // HTML one means the catalog address isn't live on Marcolini yet.
      return reason ?? "Marcolini todavía no tiene publicada la conexión del catálogo (la dirección /api/v1/catalogo no existe allá).";
    case 429:
      return "Demasiadas sincronizaciones seguidas. Espera un minuto y vuelve a intentarlo.";
    default:
      return `Marcolini respondió con un error (${res.status}).${reason ? ` ${reason}` : ""}`;
  }
}

/** The whole catalog, every page. Throws MarcoliniError. */
export async function fetchMarcoliniCatalog(config: MarcoliniConfig, fetchImpl: typeof fetch = fetch): Promise<MarcoliniCatalog> {
  let creator: MarcoliniCatalog["creator"] | null = null;
  let brands: MarcoliniBrand[] = [];
  const products: MarcoliniProduct[] = [];
  let skipped = 0;
  let cursor: string | null = null;
  // After a redirect the next pages go straight to where Marcolini answered.
  let base = config.baseUrl;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL("/api/v1/catalogo", base);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("cursor", cursor);

    const answered = await getWithKey(url, config, fetchImpl);
    const res = answered.res;
    base = answered.url.origin;
    if (!res.ok) throw new MarcoliniError(await errorMessage(res, config));

    const parsed = pageSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new MarcoliniError("Marcolini respondió algo que no es el catálogo. Revisa MARCOLINI_API_URL.");

    if (!creator) {
      creator = parsed.data.creator;
      // Brands come whole on every page; the first page's list is the one.
      for (const raw of parsed.data.brands) {
        const brand = brandSchema.safeParse(raw);
        if (brand.success) brands.push(brand.data);
        else skipped++;
      }
    }
    for (const raw of parsed.data.products) {
      const product = productSchema.safeParse(raw);
      if (product.success && product.data.currency === "COP") products.push(product.data);
      else skipped++;
    }

    cursor = parsed.data.nextCursor;
    if (!cursor) break;
  }

  const brandIds = new Set(brands.map((b) => b.id));
  const kept = products.filter((p) => brandIds.has(p.brandId));
  skipped += products.length - kept.length;
  brands = brands.sort((a, b) => a.vitrinaOrder - b.vitrinaOrder);
  return { creator: creator!, brands, products: kept, skipped, servedFrom: new URL(base).host };
}
