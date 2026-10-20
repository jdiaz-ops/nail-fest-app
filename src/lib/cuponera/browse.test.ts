import { describe, expect, it } from "vitest";
import {
  categoryTiles,
  categoryTree,
  highlightParts,
  popularSuggestions,
  rankSuggestions,
  suggestionIndex,
  suggestionScore,
  colorsPresent,
  combinedRating,
  frontPageRows,
  groupByLine,
  listHref,
  lineCountLabel,
  searchScore,
  searchWords,
  sizesPresent,
  sortOptions,
  sortTiles,
  subcategoriesPresent,
  toneName,
  type CuponeraLine,
} from "./browse";
import { variantsLabelOf, type CuponeraBrandCard, type CuponeraProduct } from "./shared";

function product(id: string, extra: Partial<CuponeraProduct> = {}): CuponeraProduct {
  return {
    id,
    brand: "Marca A",
    name: id,
    price: 10000,
    before: 12000,
    priceFrom: false,
    code: "NAILFEST",
    imageUrl: null,
    icon: "bottle",
    color: "#000",
    tint: "#fff",
    category: null,
    subcategory: null,
    professions: [],
    url: null,
    colorFamily: null,
    size: null,
    line: null,
    variant: null,
    variantCount: 0,
    variantsLabel: null,
    rating: null,
    unitsLeft: null,
    soldWithCode: 0,
    description: null,
    ...extra,
  };
}

describe("groupByLine", () => {
  it("puts the tones of a line in one card, where the first one was", () => {
    const tiles = groupByLine([
      product("lamp"),
      product("princesa", { line: "Gel Polish Rosados" }),
      product("tips"),
      product("bailarina", { line: "gel polish rosados" }),
    ]);
    expect(tiles.map((t) => t.kind)).toEqual(["product", "line", "product"]);
    const line = tiles[1]!;
    expect(line.kind === "line" && line.line.members.map((p) => p.id)).toEqual(["princesa", "bailarina"]);
  });

  it("keeps lines of different brands apart and a lone tone as a plain card", () => {
    const tiles = groupByLine([
      product("a1", { line: "Gel Polish" }),
      product("b1", { brand: "Marca B", line: "Gel Polish" }),
      product("a2", { line: "Gel Polish" }),
    ]);
    expect(tiles.map((t) => (t.kind === "line" ? t.line.members.length : t.product.id))).toEqual([2, "b1"]);
  });
});

describe("line card texts", () => {
  const line = (members: CuponeraProduct[]): CuponeraLine => ({ key: "k", brand: "Marca A", name: "Gel Polish", members });

  it("counts tones for shades and versions for the rest", () => {
    expect(lineCountLabel(line([product("a", { category: "esmaltes" }), product("b", { category: "esmaltes" })]))).toBe("2 tonos");
    expect(lineCountLabel(line([product("a", { colorFamily: "Rosados" }), product("b")]))).toBe("2 tonos");
    expect(lineCountLabel(line([product("a", { category: "kits" }), product("b", { category: "kits" })]))).toBe("2 versiones");
  });

  it("names a tone by its variant or by what follows the line", () => {
    expect(toneName(product("x", { name: "Gel Polish – Princesa", variant: "Princesa" }), "Gel Polish")).toBe("Princesa");
    expect(toneName(product("x", { name: "Gel Polish – SUPER BLACK" }), "Gel Polish")).toBe("SUPER BLACK");
    expect(toneName(product("x", { name: "Lámpara 48W" }), "Gel Polish")).toBe("Lámpara 48W");
  });

  it("weights the reviews of every tone", () => {
    expect(combinedRating([product("a", { rating: { average: 5, count: 1 } }), product("b", { rating: { average: 4, count: 3 } }), product("c")])).toEqual({
      average: 4.25,
      count: 4,
    });
    expect(combinedRating([product("a")])).toBeNull();
  });
});

describe("searchScore", () => {
  const gel = product("gel", {
    name: "Gel Polish – Princesa",
    line: "Gel Polish Rosados",
    variant: "Princesa",
    colorFamily: "Rosados",
    size: "15 ml",
    category: "esmaltes",
    subcategory: "semipermanente",
    description: "Ideal para curar con lámpara LED.",
  });

  it("finds by name, tone, color, size and category, accents and plurals aside", () => {
    for (const q of ["princesa", "gel rosa", "rosados", "15ml", "15 ml", "esmaltes", "semipermanente", "GEL POLISH"]) {
      expect(searchScore(gel, searchWords(q))).toBe(2);
    }
  });

  it("matches the start of words only", () => {
    expect(searchScore(product("angel", { name: "Angel Wings" }), searchWords("gel"))).toBe(0);
  });

  it("ranks a match found only in the description below", () => {
    expect(searchScore(gel, searchWords("lamparas"))).toBe(1);
    expect(searchScore(gel, searchWords("torno"))).toBe(0);
  });
});

describe("filters", () => {
  it("lists colors in the filter's order and sizes small to big", () => {
    const list = [
      product("a", { colorFamily: "Negros", size: "30 ml" }),
      product("b", { colorFamily: "Rosados", size: "15 ml" }),
      product("c", { colorFamily: "Rosados", size: "30 g" }),
      product("d", { size: "8 ml" }),
    ];
    expect(colorsPresent(list).map((c) => [c.name, c.count])).toEqual([
      ["Rosados", 2],
      ["Negros", 1],
    ]);
    expect(sizesPresent(list)).toEqual(["8 ml", "15 ml", "30 ml", "30 g"]);
  });

  it("lists only the subcategories that have products", () => {
    const list = [product("a", { category: "herramientas", subcategory: "limas" }), product("b", { category: "herramientas", subcategory: "lamparas" })];
    expect(subcategoriesPresent(list, "herramientas").map((s) => s.key)).toEqual(["lamparas", "limas"]);
  });
});

describe("sort", () => {
  it("offers only the sorts these products can back", () => {
    expect(sortOptions([product("a"), product("b")]).map((o) => o.key)).toEqual(["recomendados", "precio"]);
    expect(
      sortOptions([product("a", { rating: { average: 4, count: 2 }, soldWithCode: 1 }), product("b", { price: 9000 })]).map((o) => o.key),
    ).toEqual(["recomendados", "calificados", "vendidos", "descuento", "precio"]);
  });

  it("sorts lines by their best member and keeps ties in order", () => {
    const tiles = groupByLine([
      product("solo", { price: 20000, before: 20000 }),
      product("t1", { line: "Gel", price: 15000, soldWithCode: 2 }),
      product("t2", { line: "Gel", price: 9000, soldWithCode: 3 }),
      product("cheap", { price: 12000, soldWithCode: 4 }),
    ]);
    const ids = (sorted: ReturnType<typeof sortTiles>) => sorted.map((t) => (t.kind === "line" ? "line" : t.product.id));
    expect(ids(sortTiles(tiles, "precio"))).toEqual(["line", "cheap", "solo"]);
    expect(ids(sortTiles(tiles, "vendidos"))).toEqual(["line", "cheap", "solo"]);
    expect(ids(sortTiles(tiles, "recomendados"))).toEqual(["solo", "line", "cheap"]);
  });

  it("doesn't let a lone 5 stars beat 4,8 from many reviews", () => {
    const tiles = groupByLine([product("one", { rating: { average: 5, count: 1 } }), product("many", { rating: { average: 4.8, count: 100 } }), product("none")]);
    expect(sortTiles(tiles, "calificados").map((t) => (t.kind === "product" ? t.product.id : ""))).toEqual(["many", "one", "none"]);
  });
});

describe("variantsLabelOf", () => {
  it.each([
    [24, ["Color"], "esmaltes", "24 tonos"],
    [2, ["Color"], "herramientas", "2 colores"],
    [2, ["Color"], null, "2 colores"],
    [3, ["Tamaño"], "esmaltes", "3 tamaños"],
    [4, ["Aroma"], "cuidado", "4 aromas"],
    [24, ["Color", "Tamaño"], "esmaltes", "24 opciones"],
    [2, [], null, "2 opciones"],
    [1, ["Color"], "esmaltes", null],
  ] as const)("%i variants of %j in %s → %s", (count, names, category, label) => {
    expect(variantsLabelOf(count, [...names], category)).toBe(label);
  });
});

describe("categoryTree", () => {
  it("lists the categories and types that have products, with their counts", () => {
    const tree = categoryTree([
      product("a", { category: "esmaltes", subcategory: "semipermanente" }),
      product("b", { category: "esmaltes", subcategory: "semipermanente" }),
      product("c", { category: "esmaltes" }),
      product("d", { category: "acrilico", subcategory: "monomero" }),
      product("e"),
    ]);
    expect(tree.map((c) => [c.key, c.chip, c.count])).toEqual([
      ["esmaltes", "Esmaltes", 3],
      ["acrilico", "Acrílico", 1],
    ]);
    expect(tree[0]!.subcategories).toEqual([{ key: "semipermanente", label: "Semipermanente", count: 2 }]);
    expect(tree[1]!.subcategories).toEqual([{ key: "monomero", label: "Líquidos", count: 1 }]);
  });
});

describe("frontPageRows", () => {
  const gel = (id: string) => product(id, { category: "esmaltes", subcategory: "semipermanente", line: "Gel Polish" });
  const base = { bestsellers: [], lists: [], newProducts: [], bestsellersTitle: "Lo más comprado", bestsellersSubtitle: "Últimos 90 días", newTitle: "Lo nuevo", newSubtitle: "Recién llegado" };

  it("puts what sells first, the lists in order, what's new last", () => {
    const rows = frontPageRows({
      ...base,
      bestsellers: groupByLine([product("x"), product("y"), product("z")]),
      lists: [
        { slug: "semis", title: "Semis", subtitle: null, kind: "category", category: "esmaltes", subcategory: "semipermanente", products: [gel("g1"), gel("g2"), product("p")] },
        { slug: "acrilico", title: "Acrílico", subtitle: "Una lista de Nail Fest", kind: "products", category: null, subcategory: null, products: [gel("g2"), gel("g1")] },
      ],
      newProducts: [product("n1"), product("n2")],
    });
    expect(rows.map((r) => [r.key, r.href])).toEqual([
      ["lo-mas-comprado", "/cuponera/lo-mas-comprado"],
      ["lista-semis", "/cuponera/esmaltes/semipermanente"],
      ["lista-acrilico", "/cuponera/lista/acrilico"],
      ["lo-nuevo", "/cuponera/lo-nuevo"],
    ]);
    expect(rows[0]!.ranked).toBe(true);
    expect(rows[3]!.isNew).toBe(true);
    // A category groups the tones of a line; chosen products stay one by one.
    expect(rows[1]!.tiles.map((t) => t.kind)).toEqual(["line", "product"]);
    expect(rows[2]!.tiles.map((t) => (t.kind === "product" ? t.product.id : ""))).toEqual(["g2", "g1"]);
  });

  it("leaves out rows that would look empty", () => {
    const rows = frontPageRows({
      ...base,
      lists: [
        { slug: "uno", title: "Uno", subtitle: null, kind: "category", category: "kits", subcategory: null, products: [product("k")] },
        { slug: "vacia", title: "Vacía", subtitle: null, kind: "products", category: null, subcategory: null, products: [] },
        { slug: "una", title: "Una", subtitle: null, kind: "products", category: null, subcategory: null, products: [product("p")] },
      ],
    });
    expect(rows.map((r) => r.key)).toEqual(["lista-una"]);
  });

  it("knows where each list's «Ver todo» goes", () => {
    expect(listHref({ slug: "x", category: "herramientas", subcategory: null })).toBe("/cuponera/herramientas");
    expect(listHref({ slug: "para-empezar", category: null, subcategory: null })).toBe("/cuponera/lista/para-empezar");
  });
});


describe("categoryTiles", () => {
  const cats = (...keys: ("esmaltes" | "herramientas" | "cuidado" | "stamping" | "kits")[]) =>
    categoryTree(keys.flatMap((key, i) => [product(`${key}-1`, { category: key }), ...(i === 0 ? [product(`${key}-2`, { category: key })] : [])]));
  const base = { images: {}, bestsellers: [], newProducts: [], lists: [], brandCount: 1, productCount: 24 };

  it("closes a short last row with what's new and «Todo»", () => {
    const tiles = categoryTiles({ ...base, categories: cats("esmaltes", "herramientas", "cuidado", "stamping"), newProducts: [product("n")] });
    expect(tiles.map((t) => t.key)).toEqual(["esmaltes", "herramientas", "cuidado", "stamping", "lo-nuevo", "todo"]);
    expect(tiles.map((t) => t.count)).toEqual(["2 productos", "1 producto", "1 producto", "1 producto", "1 producto", "24 productos"]);
    expect(tiles.at(-1)!.href).toBe("/cuponera/todo");
  });

  it("uses the brands when there's nothing else, and adds nothing to a full row", () => {
    expect(categoryTiles({ ...base, categories: cats("kits") }).map((t) => [t.key, t.count, t.href])).toEqual([
      ["kits", "2 productos", "/cuponera/kits"],
      ["marcas", "1 marca", "#marcas"],
      ["todo", "24 productos", "/cuponera/todo"],
    ]);
    expect(categoryTiles({ ...base, categories: cats("esmaltes", "cuidado") }).map((t) => t.key)).toEqual(["esmaltes", "cuidado", "todo"]);
    expect(categoryTiles({ ...base, categories: cats("esmaltes", "cuidado", "kits") }).map((t) => t.key)).toEqual(["esmaltes", "cuidado", "kits"]);
  });

  it("takes what sells and the admin's product lists before the brands", () => {
    const tiles = categoryTiles({
      ...base,
      categories: cats("esmaltes"),
      bestsellers: groupByLine([product("x"), product("y")]),
      lists: [{ slug: "acrilico", title: "Para empezar en acrílico", subtitle: null, kind: "products", category: null, subcategory: null, products: [product("p")] }],
    });
    expect(tiles.map((t) => t.key)).toEqual(["esmaltes", "lo-mas-comprado", "todo"]);
    expect(tiles[1]!.count).toBe("2 productos");
  });
});

describe("search suggestions", () => {
  const brand = (name: string, code: string): CuponeraBrandCard => ({
    id: name,
    name,
    initial: name.charAt(0),
    logoUrl: null,
    tone: "pink",
    discountPercent: 10,
    code,
    storeUrl: null,
    title: "10 % de descuento",
    exclusive: false,
    shipping: null,
    inPanel: true,
  });
  const products = [
    product("e1", { brand: "H la Cosedora", name: "Esmalte tradicional Rojo", category: "esmaltes", subcategory: "tradicional" }),
    product("e2", { brand: "H la Cosedora", name: "Esmalte tradicional Negro", category: "esmaltes", subcategory: "tradicional" }),
    product("l1", { brand: "H la Cosedora", name: "Lima 100/180", category: "herramientas", subcategory: "limas" }),
    product("g1", { brand: "Lumière", name: "Gel Polish – Rubí", line: "Gel Polish", colorFamily: "Rojo" }),
    product("g2", { brand: "Lumière", name: "Gel Polish – Arena", line: "Gel Polish", colorFamily: "Nude" }),
  ];
  const index = suggestionIndex(products, [brand("H la Cosedora", "NAILFEST"), brand("Lumière", "NF15")], categoryTree(products));

  it("scores the start of the label, the start of its words, then the inside", () => {
    expect(suggestionScore("H la Cosedora", "h la")).toBe(3);
    expect(suggestionScore("Esmalte tradicional Rojo", "rojo esm")).toBe(2);
    expect(suggestionScore("H la Cosedora", "osedo")).toBe(1);
    expect(suggestionScore("Lámpara UV", "la")).toBe(3);
    expect(suggestionScore("Gel Polish", "la")).toBe(0);
    expect(suggestionScore("Cualquier cosa", "  ")).toBe(0);
  });

  it("suggests the brand with its code, then categories, then products", () => {
    const found = rankSuggestions(index, "h la");
    expect(found.map((s) => [s.kind, s.label])).toEqual([["marca", "H la Cosedora"]]);
    expect(found[0]!.detail).toBe("10 % de descuento con el código NAILFEST");
    expect(found[0]!.href).toBe("/cuponera/buscar?q=H%20la%20Cosedora");
    const esm = rankSuggestions(index, "esm");
    expect(esm.map((s) => [s.kind, s.label])).toEqual([
      ["categoria", "Esmaltes"],
      ["categoria", "Esmalte tradicional"],
      ["producto", "Esmalte tradicional Rojo"],
      ["producto", "Esmalte tradicional Negro"],
    ]);
    expect(esm.map((s) => s.href).slice(0, 2)).toEqual(["/cuponera/esmaltes", "/cuponera/esmaltes/tradicional"]);
    // A line comes once, with its tones.
    expect(rankSuggestions(index, "gel").map((s) => [s.label, s.detail])).toEqual([["Gel Polish", "Lumière · 2 tonos"]]);
  });

  it("bolds what matched, accents and all", () => {
    expect(highlightParts("Lumière", "lumie")).toEqual([
      ["Lumiè", true],
      ["re", false],
    ]);
    expect(highlightParts("Esmalte tradicional Rojo", "rojo")).toEqual([
      ["Esmalte tradicional ", false],
      ["Rojo", true],
    ]);
    expect(highlightParts("Lima 100/180", "")).toEqual([["Lima 100/180", false]]);
  });

  it("offers the biggest brands and categories before typing", () => {
    expect(popularSuggestions(index).map((s) => s.label).slice(0, 3)).toEqual(["H la Cosedora", "Lumière", "Esmaltes"]);
  });
});
