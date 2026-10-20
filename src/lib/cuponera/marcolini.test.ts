import { describe, expect, it } from "vitest";
import { cleanMarcoliniKey, fetchMarcoliniCatalog, marcoliniConfig, MarcoliniError } from "./marcolini";
import { guessCategory, priceWithCode } from "./shared";

const config = { baseUrl: "https://marcolini.test", apiKey: "k".repeat(40) };

const brand = {
  id: "b1",
  name: "Lumière Nails",
  logoUrl: "https://blob.test/logo.png",
  storeUrl: "https://lumiere.marcolini.lat/?ref=NAILFEST",
  storeKind: "MARCOLINI",
  codeAppliedByLink: true,
  discountCode: "NAILFEST",
  discountPercent: 15,
  commissionPercent: 10,
  campaign: null,
  visibleInVitrina: true,
  vitrinaOrder: 0,
};

function product(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    brandId: "b1",
    name: `Producto ${id}`,
    imageUrl: null,
    price: 45000,
    priceMax: null,
    compareAtPrice: null,
    currency: "COP",
    url: `https://lumiere.marcolini.lat/${id}?ref=NAILFEST`,
    category: null,
    collections: [],
    type: "PHYSICAL",
    createdAt: "2026-10-01T12:00:00.000Z",
    ...extra,
  };
}

function fakeFetch(pages: Record<string, { status?: number; body: unknown }>) {
  const calls: { url: string; auth: string | null }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), auth: new Headers(init?.headers).get("authorization") });
    const page = pages[url.searchParams.get("cursor") ?? ""];
    if (!page) return new Response("<html>404</html>", { status: 404, headers: { "content-type": "text/html" } });
    return new Response(JSON.stringify(page.body), { status: page.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { impl, calls };
}

const creator = { displayName: "Nail Fest", storefrontSlug: "nailfest" };

describe("fetchMarcoliniCatalog", () => {
  it("reads every page with the key and keeps brands from the first page", async () => {
    const { impl, calls } = fakeFetch({
      "": { body: { version: 1, creator, brands: [brand], products: [product("p1"), product("p2")], nextCursor: "p2" } },
      p2: { body: { version: 1, creator, brands: [brand], products: [product("p3")], nextCursor: null } },
    });
    const catalog = await fetchMarcoliniCatalog(config, impl);
    expect(catalog.creator.storefrontSlug).toBe("nailfest");
    expect(catalog.brands.map((b) => b.id)).toEqual(["b1"]);
    expect(catalog.products.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.auth).toBe(`Bearer ${config.apiKey}`);
    expect(calls[0]!.url).toBe("https://marcolini.test/api/v1/catalogo?limit=1000");
    expect(calls[1]!.url).toContain("cursor=p2");
  });

  it("drops rows that don't parse, other currencies and products of unknown brands", async () => {
    const { impl } = fakeFetch({
      "": {
        body: {
          creator,
          brands: [brand, { id: "bad" }],
          products: [
            product("ok"),
            product("usd", { currency: "USD" }),
            product("js", { url: "javascript:alert(1)" }),
            product("orphan", { brandId: "nope" }),
            product("pic", { imageUrl: "javascript:x" }),
          ],
          nextCursor: null,
        },
      },
    });
    const catalog = await fetchMarcoliniCatalog(config, impl);
    expect(catalog.products.map((p) => p.id)).toEqual(["ok", "pic"]);
    // A bad picture only loses the picture.
    expect(catalog.products[1]!.imageUrl).toBeNull();
    expect(catalog.skipped).toBe(4);
  });

  it("explains each failure in words the admin can act on", async () => {
    const fail = (status: number, body: unknown) => fakeFetch({ "": { status, body } }).impl;
    await expect(fetchMarcoliniCatalog(config, fail(401, { error: "x" }))).rejects.toThrow(/no reconoce la llave/);
    await expect(fetchMarcoliniCatalog(config, fail(401, { error: "x", reason: "no_keys" }))).rejects.toThrow(/Marcolini todavía no tiene la llave/);
    await expect(fetchMarcoliniCatalog(config, fail(401, { error: "x", reason: "mismatch" }))).rejects.toThrow(/termina en …kkkk/);
    const html401 = (async () => new Response("<html>Vercel login</html>", { status: 401, headers: { "content-type": "text/html" } })) as typeof fetch;
    await expect(fetchMarcoliniCatalog(config, html401)).rejects.toThrow(/Revisa MARCOLINI_API_URL/);
    await expect(fetchMarcoliniCatalog(config, fail(404, { error: "La llave apunta a una vitrina que no existe en Marcolini." }))).rejects.toThrow(
      /vitrina que no existe/,
    );
    await expect(fetchMarcoliniCatalog(config, fakeFetch({}).impl)).rejects.toThrow(/todavía no tiene publicada/);
    await expect(fetchMarcoliniCatalog(config, fail(200, { hola: 1 }))).rejects.toBeInstanceOf(MarcoliniError);
    const offline = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await expect(fetchMarcoliniCatalog(config, offline)).rejects.toThrow(/No se pudo conectar con Marcolini/);
  });
});

describe("guessCategory", () => {
  it.each([
    ["Gel semipermanente Rojo Pasión", [], "geles"],
    ["Top coat sellador UV", [], "geles"],
    ["Base rubber fortalecedora", [], "geles"],
    ["Lámpara UV/LED portátil 48W", [], "lamparas"],
    ["Removedor de cutículas", [], "cuidado"],
    ["Aceite de cutículas almendra", [], "cuidado"],
    ["Pincel liner 00 para nail art", [], "nailart"],
    ["Polvo acrílico clear 30 g", [], "acrilico"],
    ["Monómero líquido 120 ml", [], "acrilico"],
    ["Tips coffin x500", [], "acrilico"],
    ["Lima 100/180 x10", [], "herramientas"],
    ["Pusher acero inoxidable", [], "herramientas"],
    ["Rosa chicle 15 ml", ["Geles"], "geles"],
    ["Kit manicure francesa", [], null],
  ] as const)("%s → %s", (name, hints, expected) => {
    expect(guessCategory(name, [...hints])).toBe(expected);
  });
});

describe("priceWithCode", () => {
  it("applies the code's percent and rounds to whole pesos", () => {
    expect(priceWithCode(45000, 15)).toBe(38250);
    expect(priceWithCode(39990, 12.5)).toBe(34991);
    expect(priceWithCode(45000, 0)).toBe(45000);
  });
});

describe("the key as pasted in Vercel", () => {
  const key = "aa4b009c08123e82b9f919c62dfe46a8528b99aace942c217cd823d11efd6452";

  it.each([
    [key, key],
    [`"${key}"`, key],
    [`  ${key}\n`, key],
    [`nailfest:${key}`, key],
    [`"nailfest: ${key}"`, key],
    [`${key.slice(0, 32)}\n${key.slice(32)}`, key],
  ])("%j → the bare key", (pasted, expected) => {
    expect(cleanMarcoliniKey(pasted)).toBe(expected);
  });

  it("reads MARCOLINI_API_KEY cleaned, and defaults the address", () => {
    const before = { ...process.env };
    process.env.MARCOLINI_API_KEY = `'nailfest:${key}'`;
    delete process.env.MARCOLINI_API_URL;
    expect(marcoliniConfig()).toEqual({ baseUrl: "https://marcolini.lat", apiKey: key });
    process.env.MARCOLINI_API_KEY = '""';
    expect(marcoliniConfig()).toBeNull();
    process.env = before;
  });
});
