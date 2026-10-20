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
    await expect(fetchMarcoliniCatalog(config, fail(401, { error: "x", reason: "mismatch" }))).rejects.toThrow(/kkkk…kkkk, 40 caracteres/);
    const hexConfig = { ...config, apiKey: "ab12".repeat(16) };
    await expect(fetchMarcoliniCatalog(hexConfig, fail(401, { error: "x", reason: "mismatch", keyLengths: [65] }))).rejects.toThrow(
      /tiene 65 caracteres y la de Nail Fest 64 \(ab12…ab12\).*Revisa CATALOG_API_KEYS en el proyecto de Marcolini/,
    );
    await expect(fetchMarcoliniCatalog(config, fail(401, { error: "x", reason: "mismatch", keyLengths: [41] }))).rejects.toThrow(
      /La llave de Marcolini tiene 41 caracteres y la de Nail Fest 40/,
    );
    await expect(fetchMarcoliniCatalog(config, fail(401, { error: "x", reason: "mismatch", keyLengths: [40] }))).rejects.toThrow(
      /tienen 40 caracteres pero son distintas/,
    );
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

describe("redirects", () => {
  // A fake web: each URL answers what the map says; records the key it got.
  function web(routes: Record<string, { status: number; location?: string; body?: unknown }>) {
    const calls: { url: string; auth: string | null; redirect: RequestRedirect | undefined }[] = [];
    const impl = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, auth: new Headers(init?.headers).get("authorization"), redirect: init?.redirect });
      const route = routes[url];
      if (!route) return new Response("not found", { status: 404 });
      const headers: Record<string, string> = route.location ? { location: route.location } : { "content-type": "application/json" };
      return new Response(route.body === undefined ? null : JSON.stringify(route.body), { status: route.status, headers });
    }) as typeof fetch;
    return { impl, calls };
  }
  const page = (products: unknown[], nextCursor: string | null) => ({ creator, brands: [brand], products, nextCursor });

  it("follows marcolini.lat → www.marcolini.lat with the key, and asks the next pages there directly", async () => {
    const { impl, calls } = web({
      "https://marcolini.test/api/v1/catalogo?limit=1000": { status: 308, location: "https://www.marcolini.test/api/v1/catalogo?limit=1000" },
      "https://www.marcolini.test/api/v1/catalogo?limit=1000": { status: 200, body: page([product("p1")], "p1") },
      "https://www.marcolini.test/api/v1/catalogo?limit=1000&cursor=p1": { status: 200, body: page([product("p2")], null) },
    });
    const catalog = await fetchMarcoliniCatalog(config, impl);
    expect(catalog.products.map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(catalog.servedFrom).toBe("www.marcolini.test");
    expect(calls.map((c) => c.url)).toEqual([
      "https://marcolini.test/api/v1/catalogo?limit=1000",
      "https://www.marcolini.test/api/v1/catalogo?limit=1000",
      "https://www.marcolini.test/api/v1/catalogo?limit=1000&cursor=p1",
    ]);
    expect(calls.every((c) => c.auth === `Bearer ${config.apiKey}` && c.redirect === "manual")).toBe(true);
  });

  it("never sends the key to another site or down to http", async () => {
    const elsewhere = web({ "https://marcolini.test/api/v1/catalogo?limit=1000": { status: 302, location: "https://otro.test/robar" } });
    await expect(fetchMarcoliniCatalog(config, elsewhere.impl)).rejects.toThrow(/no le mando la llave/);
    expect(elsewhere.calls).toHaveLength(1);
    const downgrade = web({ "https://marcolini.test/api/v1/catalogo?limit=1000": { status: 301, location: "http://www.marcolini.test/api/v1/catalogo?limit=1000" } });
    await expect(fetchMarcoliniCatalog(config, downgrade.impl)).rejects.toThrow(/no le mando la llave/);
    expect(downgrade.calls).toHaveLength(1);
  });

  it("says when Marcolini got no key at all", async () => {
    const { impl } = web({ "https://marcolini.test/api/v1/catalogo?limit=1000": { status: 401, body: { error: "x", reason: "missing_key" } } });
    await expect(fetchMarcoliniCatalog(config, impl)).rejects.toThrow(/no le llegó la llave/);
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
    [`${key}.`, key],
    [`**${key}**`, key],
    [`MARCOLINI_API_KEY = ${key}`, key],
    [`Bearer ${key}`, key],
    [`nailfest:nailfest:${key}`, key],
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
