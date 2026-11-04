import { describe, expect, it } from "vitest";
import { IMPARABLES_REVIEW_TEXTS, reviewNotYet, starsFrom } from "./resena";

describe("Manicuristas Imparables' review page", () => {
  it("starts rated from the email's stars, only from 1 to 5", () => {
    expect(starsFrom("5")).toBe(5);
    expect(starsFrom("1")).toBe(1);
    for (const value of [undefined, "", "0", "6", "4.5", "cinco"]) expect(starsFrom(value)).toBe(0);
  });

  it("speaks of a virtual congress: no door, no scan, no fair", () => {
    const all = Object.values(IMPARABLES_REVIEW_TEXTS).join(" ");
    expect(all).not.toMatch(/puerta|escane|marcas que encontraste|demostraciones/i);
    expect(IMPARABLES_REVIEW_TEXTS.rewardTitle).toBe("Acceso anticipado a la próxima edición");
    expect(reviewNotYet("domingo 4 de julio")).toBe("Tu reseña se abre al terminar el congreso, el domingo 4 de julio.");
  });
});
