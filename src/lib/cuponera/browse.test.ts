import { describe, expect, it } from "vitest";
import {
  colorsPresent,
  combinedRating,
  groupByLine,
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
import { variantsLabelOf, type CuponeraProduct } from "./shared";

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
