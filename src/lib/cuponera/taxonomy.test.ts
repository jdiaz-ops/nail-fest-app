import { describe, expect, it } from "vitest";
import { classifyProduct, collectionKey, sizeOf } from "./shared";
import { freeShippingLine, resolveCategory, type CollectionMapping } from "./data";

describe("classifyProduct", () => {
  it.each([
    ["Gel semipermanente Rojo Pasión", "esmaltes", "semipermanente"],
    ["Esmalte tradicional Coral", "esmaltes", "tradicional"],
    ["Top coat sellador UV", "cuidado", "top-base"],
    ["Base rubber fortalecedora", "construccion", "rubber"],
    ["Polygel nude 30 g", "construccion", "polygel"],
    ["Gel builder rosa", "construccion", "builder"],
    ["Lámpara UV/LED portátil 48W", "herramientas", "lamparas"],
    ["Torno eléctrico profesional", "herramientas", "tornos"],
    ["Lima 100/180 x10", "herramientas", "limas"],
    ["Pincel acrílico kolinsky #10", "herramientas", "pinceles"],
    ["Pusher acero inoxidable", "herramientas", "alicates"],
    ["Polvo acrílico clear 30 g", "acrilico", "polvos"],
    ["Monómero líquido 120 ml", "acrilico", "monomero"],
    ["Tips coffin x500", "softgel", "tips"],
    ["Uñas press-on almendra x24", "softgel", "press-on"],
    ["Aceite de cutículas almendra", "cuidado", "cuticulas"],
    ["Removedor de cutículas", "cuidado", "cuticulas"],
    ["Crema de manos karité", "cuidado", "manos"],
    ["Deshidratador y primer", "cuidado", "preparacion"],
    ["Cromo espejo plata", "decoracion", "efectos"],
    ["Stickers Selva Pop", "decoracion", "stickers"],
    ["Placa de stamping flores", "stamping", null],
    ["Kit manicure francesa", "kits", null],
    // Collections and store categories named after the category itself.
    ["Herramientas", "herramientas", null],
    ["Herramientas y equipos", "herramientas", null],
    ["Cuidado de manos", "cuidado", "manos"],
    ["Preparación y cuidado", "cuidado", null],
  ] as const)("%s → %s / %s", (name, category, subcategory) => {
    expect(classifyProduct({ name })).toEqual({ category, subcategory });
  });

  it("uses the collections, then Marcolini's own category, when the name says nothing", () => {
    expect(classifyProduct({ name: "Rosa chicle 15 ml", collections: ["Geles semipermanentes"] })).toEqual({ category: "esmaltes", subcategory: "semipermanente" });
    expect(classifyProduct({ name: "Princesa", line: "Gel Polish Rosados" })).toEqual({ category: "esmaltes", subcategory: "semipermanente" });
    expect(classifyProduct({ name: "Referencia 0042", nicheCategory: "Gel de construcción" })).toEqual({ category: "construccion", subcategory: null });
    expect(classifyProduct({ name: "Referencia 0042" })).toEqual({ category: null, subcategory: null });
  });
});

describe("sizeOf", () => {
  it.each([
    ["Gel 15ML", null, "15 ml"],
    ["Monómero líquido 120 ml", null, "120 ml"],
    ["Polvo acrílico 30 gr", null, "30 g"],
    ["Tips coffin x500", null, "500 und"],
    ["Aceite 7,5 ml", null, "7,5 ml"],
    ["Gel Rosa", "10 ml", "10 ml"],
    ["Lámpara 48W", null, null],
  ] as const)("%s (%s) → %s", (name, attribute, expected) => {
    expect(sizeOf(name, attribute)).toBe(expected);
  });
});

describe("collectionKey", () => {
  it("joins the same collection written differently across brands", () => {
    const key = collectionKey("Esmaltes Semipermanentes");
    expect(collectionKey("esmalte semipermanente")).toBe(key);
    expect(collectionKey("Semipermanentes esmaltes")).toBe(key);
    expect(collectionKey("Geles")).toBe(collectionKey("gel"));
    expect(collectionKey("Pinceles para uñas")).toBe(collectionKey("Pincel uñas"));
    expect(collectionKey("Novedades")).not.toBe(key);
  });
});

describe("resolveCategory", () => {
  const row = {
    name: "Gel semipermanente Rosa",
    line: null,
    sourceCategory: null,
    category: null,
    subcategory: null,
    autoCategory: "esmaltes",
    autoSubcategory: "semipermanente",
    collections: ["Geles de construcción"],
  };
  const mapped = new Map<string, CollectionMapping>([[collectionKey("Geles de construcción"), { category: "construccion", subcategory: "builder", ignored: false }]]);

  it("the admin's pick wins, then a mapped collection, then the sync's guess", () => {
    expect(resolveCategory(row, new Map())).toEqual({ category: "esmaltes", subcategory: "semipermanente", source: "auto" });
    expect(resolveCategory(row, mapped)).toEqual({ category: "construccion", subcategory: "builder", source: "coleccion" });
    expect(resolveCategory({ ...row, category: "kits" }, mapped)).toEqual({ category: "kits", subcategory: null, source: "manual" });
  });

  it("skips ignored collections and subcategories outside their category", () => {
    const ignored = new Map<string, CollectionMapping>([[collectionKey("Geles de construcción"), { category: null, subcategory: null, ignored: true }]]);
    expect(resolveCategory(row, ignored).source).toBe("auto");
    expect(resolveCategory({ ...row, category: "herramientas", subcategory: "semipermanente" }, new Map()).subcategory).toBeNull();
    expect(resolveCategory({ ...row, category: "esmaltes" }, new Map()).subcategory).toBe("semipermanente");
  });

  it("a category mapped or picked without a subcategory keeps the product's own", () => {
    const file = { ...row, name: "Lima 100/180 x10", collections: ["Herramientas"], autoCategory: "herramientas", autoSubcategory: "limas" };
    const tools = new Map<string, CollectionMapping>([[collectionKey("Herramientas"), { category: "herramientas", subcategory: null, ignored: false }]]);
    expect(resolveCategory(file, tools)).toEqual({ category: "herramientas", subcategory: "limas", source: "coleccion" });
    expect(resolveCategory({ ...file, category: "herramientas" }, new Map())).toEqual({ category: "herramientas", subcategory: "limas", source: "manual" });
    expect(resolveCategory({ ...file, category: "kits" }, new Map()).subcategory).toBeNull();
  });
});

describe("freeShippingLine", () => {
  it("says it as a buyer reads it", () => {
    expect(freeShippingLine({ freeShippingFrom: 120000, freeShippingAllZones: true })).toBe("Envío gratis desde $120.000");
    expect(freeShippingLine({ freeShippingFrom: 150000, freeShippingAllZones: false })).toBe("Envío gratis desde $150.000 en algunas zonas");
    expect(freeShippingLine({ freeShippingFrom: 0, freeShippingAllZones: true })).toBe("Envío gratis");
    expect(freeShippingLine({ freeShippingFrom: null, freeShippingAllZones: false })).toBeNull();
  });
});
