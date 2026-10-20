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

export interface MarcoliniConfig {
  baseUrl: string;
  apiKey: string;
}

export function marcoliniConfig(): MarcoliniConfig | null {
  const apiKey = process.env.MARCOLINI_API_KEY?.trim();
  if (!apiKey) return null;
  const baseUrl = (process.env.MARCOLINI_API_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
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
}

async function errorMessage(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  const reason = typeof body?.error === "string" ? body.error : null;
  switch (res.status) {
    case 401:
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

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL("/api/v1/catalogo", config.baseUrl);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("cursor", cursor);

    let res: Response;
    try {
      res = await fetchImpl(url, {
        headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      const what = err instanceof Error && err.name === "TimeoutError" ? "Marcolini no respondió a tiempo" : "No se pudo conectar con Marcolini";
      throw new MarcoliniError(`${what} (${config.baseUrl}). Vuelve a intentarlo en un rato.`);
    }
    if (!res.ok) throw new MarcoliniError(await errorMessage(res));

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
  return { creator: creator!, brands, products: kept, skipped };
}
