import { afterEach, describe, expect, it, vi } from "vitest";
import { logoOf, renderDiplomaPdf } from "./diploma";
import { diplomaDataOf, diplomaName, SAMPLE_DIPLOMA } from "./diplomaText";

describe("diplomaName", () => {
  it("keeps her name as she wrote it", () => {
    expect(diplomaName("Yuliana Andrea", "Cárdenas Villamizar")).toBe("Yuliana Andrea Cárdenas Villamizar");
    expect(diplomaName("María José", "McAllister")).toBe("María José McAllister");
    expect(diplomaName("  Ana  ", null)).toBe("Ana");
  });

  it("writes it as a name when it came all in small letters or all in capitals", () => {
    expect(diplomaName("ana maría", "de la cruz rodríguez")).toBe("Ana María de la Cruz Rodríguez");
    expect(diplomaName("MARIA FERNANDA", "LOPEZ-OSPINA")).toBe("Maria Fernanda Lopez-Ospina");
    expect(diplomaName("de los ángeles", "")).toBe("De los Ángeles");
  });

  it("is empty without a name", () => {
    expect(diplomaName(null, undefined)).toBe("");
    expect(diplomaName(" ", "")).toBe("");
  });
});

const event = {
  name: "Manicuristas Imparables 2027",
  publicName: null,
  startsAt: new Date("2027-07-04T13:00:00Z"),
  endsAt: new Date("2027-07-04T23:30:00Z"),
  scheduleDays: null,
  landingBlocks: [
    // The brands, in their hidden section, as the cover reads them: five, and the diploma has room for four.
    { type: "heading", eyebrow: "Con el apoyo de", title: "Nuestros patrocinadores", intro: "", hidden: true },
    {
      type: "gallery",
      layout: "grid",
      showFirst: 0,
      hidden: true,
      items: [1, 2, 3, 4, 5].map((n) => ({ url: `/imparables/marcas/marca-${n}.png`, handle: ` Marca ${n} ` })),
    },
    { type: "heading", eyebrow: "Conferencistas", title: "", intro: "" },
    {
      type: "people",
      items: [
        { name: "Jimena Montalban", handle: "", tag: "", photoUrl: "", tone: "pink" },
        { name: "Paula Chacón", handle: "", tag: "", photoUrl: "", tone: "teal" },
        { name: "Oskar Garzón", handle: "", tag: "", photoUrl: "", tone: "peach" },
      ],
    },
  ],
};

describe("diplomaDataOf", () => {
  it("says the congress, its day and its speakers, as the page does", () => {
    expect(diplomaDataOf(event, "Ana María Rodríguez", "3F9K2L1Q", "America/Bogota")).toEqual({
      name: "Ana María Rodríguez",
      pre: "Manicuristas",
      big: "Imparables",
      eventName: "Manicuristas Imparables",
      kind: "congreso virtual de mentalidad, dinero y marketing para manicuristas",
      date: "domingo 4 de julio de 2027",
      speakers: ["Jimena Montalban", "Paula Chacón", "Oskar Garzón"],
      code: "3F9K2L1Q",
      stamp: "04 · 07 · 2027",
      sponsors: [1, 2, 3, 4].map((n) => ({ name: `Marca ${n}`, url: `/imparables/marcas/marca-${n}.png` })),
    });
  });
});

describe("logoOf", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a brand's PNG from the site's files", async () => {
    const logo = await logoOf("/imparables/marcas/marca-1.png");
    expect(logo?.subarray(1, 4).toString()).toBe("PNG");
  });

  it("takes only what a PDF can draw, and nothing outside the site's files", async () => {
    const fetch = vi.fn(async () => new Response("<svg/>", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await logoOf("/imparables/grupo.webp")).toBeNull();
    expect(await logoOf("/../package.json")).toBeNull();
    expect(await logoOf("https://example.com/logo.svg")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("brings an uploaded logo from where it is", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(png, { status: 200 })));
    expect(await logoOf("https://tienda.public.blob.vercel-storage.com/logo.png")).toEqual(png);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 404 })));
    expect(await logoOf("https://tienda.public.blob.vercel-storage.com/otro.png")).toBeNull();
  });
});

describe("renderDiplomaPdf", () => {
  it("draws one PDF in the page's faces", async () => {
    const pdf = await renderDiplomaPdf(diplomaDataOf(event, SAMPLE_DIPLOMA.name, SAMPLE_DIPLOMA.code, "America/Bogota"));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    // Cinzel and Manrope go inside it: with Times and Helvetica instead it would weigh a few KB.
    expect(pdf.length).toBeGreaterThan(20_000);
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  });
});
