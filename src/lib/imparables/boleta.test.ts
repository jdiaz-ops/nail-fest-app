import { describe, expect, it } from "vitest";
import { BOLETA, stubDate } from "./boleta";

describe("«Boleta Imparable»", () => {
  it("says what it brings in five short lines, in the team's order, without the welcome card or the kit", () => {
    expect(BOLETA.lines).toEqual([
      "8 conferencistas en vivo, un domingo completo",
      "4 pausas activas guiadas",
      "Grabación de cada charla disponible por 30 días",
      "Diploma digital con tu nombre",
      "Sorteo de las marcas aliadas",
    ]);
    const all = JSON.stringify(BOLETA).toLowerCase();
    for (const word of ["bienvenida", "kit", "premios", "cuaderno", "guías", "descuento"]) expect(all).not.toContain(word);
  });

  it("writes the stub's date day · month · year", () => {
    expect(stubDate("2027-06-27")).toBe("27 · 06 · 2027");
    expect(stubDate(undefined)).toBe("");
    expect(stubDate("junio")).toBe("");
  });
});
