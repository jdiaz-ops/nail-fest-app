import { describe, expect, it } from "vitest";
import { INCLUYE, isTicketIncludesTitle } from "./incluye";

describe("«Qué incluye tu cupo»", () => {
  it("takes the place of «Todo lo que trae tu boleta», not of «Lo que te llevas»", () => {
    expect(isTicketIncludesTitle("Todo lo que trae tu boleta")).toBe(true);
    expect(isTicketIncludesTitle("  todo lo que trae tu boleta ")).toBe(true);
    expect(isTicketIncludesTitle("Lo que te llevas")).toBe(false);
    expect(isTicketIncludesTitle(undefined)).toBe(false);
  });

  it("brings its seven cards in the order the team marked, and nothing unconfirmed", () => {
    expect(INCLUYE.items.map((it) => it.title)).toEqual([
      "8 conferencistas que ya lo lograron",
      "Un día pensado para tu cuerpo",
      "Vuélvelo a ver cuando quieras",
      "Tu diploma digital Imparable 2027",
      "Premios en vivo",
      "Tu tarjeta de bienvenida",
      "Tu kit Imparable",
    ]);
    const all = JSON.stringify(INCLUYE).toLowerCase();
    for (const word of ["cuaderno", "guías", "descuento"]) expect(all).not.toContain(word);
  });
});
