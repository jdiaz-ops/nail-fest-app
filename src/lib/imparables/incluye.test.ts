import { describe, expect, it } from "vitest";
import { INCLUYE, isTicketIncludesTitle } from "./incluye";

describe("«Qué incluye tu cupo»", () => {
  it("takes the place of «Todo lo que trae tu boleta», not of «Lo que te llevas»", () => {
    expect(isTicketIncludesTitle("Todo lo que trae tu boleta")).toBe(true);
    expect(isTicketIncludesTitle("  todo lo que trae tu boleta ")).toBe(true);
    expect(isTicketIncludesTitle("Lo que te llevas")).toBe(false);
    expect(isTicketIncludesTitle(undefined)).toBe(false);
  });

  it("brings its three groups — two, three and two cards — and nothing unconfirmed", () => {
    expect(INCLUYE.groups.map((g) => [g.label, g.items.length])).toEqual([
      ["Desde que reservas", 2],
      ["El 27 de junio", 3],
      ["Después", 2],
    ]);
    const all = JSON.stringify(INCLUYE).toLowerCase();
    for (const word of ["cuaderno", "guías", "descuento"]) expect(all).not.toContain(word);
  });
});
