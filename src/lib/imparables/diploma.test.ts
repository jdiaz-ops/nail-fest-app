import { describe, expect, it } from "vitest";
import { renderDiplomaPdf } from "./diploma";
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
    });
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
