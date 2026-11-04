import { describe, expect, it } from "vitest";
import { DEFAULT_MESA_BLOCKS, blockOf, blockOrder, moveBlock, shownBlocks } from "./layout";

describe("La Mesa's blocks, in each edition's order", () => {
  it("the template's order without one; a stored one made whole", () => {
    expect(blockOrder(null)).toEqual(DEFAULT_MESA_BLOCKS);
    // Each one it lacks right after the one the template has before it.
    expect(blockOrder(["OFICIO", "JUEGO", "OFICIO", "CUALQUIERA", 3])).toEqual(["OFICIO", "CONSULTORIO", "JUEGO", "IMPARABLES", "TERMOMETRO"]);
    expect(blockOrder(["CONSULTORIO", "TERMOMETRO", "OFICIO", "IMPARABLES", "JUEGO"])).toEqual(["CONSULTORIO", "TERMOMETRO", "OFICIO", "IMPARABLES", "JUEGO"]);
  });

  it("each section's piece is its block", () => {
    expect(["MITO", "PALABRA", "SABIAS", "TERMOMETRO", "TRUCO", "PORQUE"].map((s) => blockOf(s as never))).toEqual(["JUEGO", "JUEGO", "JUEGO", "TERMOMETRO", "OFICIO", "OFICIO"]);
  });

  it("shows El Consultorio while it's public and the banner when the edition carries it", () => {
    expect(shownBlocks(DEFAULT_MESA_BLOCKS, { consultorio: false, imparables: false })).toEqual(["JUEGO", "TERMOMETRO", "OFICIO"]);
    expect(shownBlocks(DEFAULT_MESA_BLOCKS, { consultorio: true, imparables: true })).toEqual(["JUEGO", "IMPARABLES", "TERMOMETRO", "OFICIO", "CONSULTORIO"]);
  });

  it("moves a block past the next one shown; the hidden ones keep their places", () => {
    const shown = shownBlocks(DEFAULT_MESA_BLOCKS, { consultorio: true, imparables: false });
    // JUEGO down: past the hidden banner, after El termómetro.
    expect(moveBlock(DEFAULT_MESA_BLOCKS, "JUEGO", "down", shown)).toEqual(["TERMOMETRO", "IMPARABLES", "JUEGO", "OFICIO", "CONSULTORIO"]);
    expect(moveBlock(DEFAULT_MESA_BLOCKS, "CONSULTORIO", "up", shown)).toEqual(["JUEGO", "IMPARABLES", "TERMOMETRO", "CONSULTORIO", "OFICIO"]);
    // Nowhere to go, or not shown: as it was.
    expect(moveBlock(DEFAULT_MESA_BLOCKS, "JUEGO", "up", shown)).toEqual(DEFAULT_MESA_BLOCKS);
    expect(moveBlock(DEFAULT_MESA_BLOCKS, "IMPARABLES", "down", shown)).toEqual(DEFAULT_MESA_BLOCKS);
  });
});
