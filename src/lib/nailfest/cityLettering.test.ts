import { afterEach, describe, expect, it, vi } from "vitest";
import { cityLettering, letterable, letteringBox, letteringSigned } from "./cityLettering";

describe("the city in Nail Fest's script", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("takes the box of its strokes: the C's loop under the line, the joins past the last letter", () => {
    const box = letteringBox("Cúcuta", 54);
    // C (from 0.738 em up to 0.182 em down) and a margin of 0.08 em on each side.
    expect(box.height).toBe(Math.ceil((738 + 182) * 0.054) + 2 * Math.ceil(80 * 0.054));
    expect(box.width).toBeGreaterThan(Math.ceil((549 + 469 + 363 + 469 + 302 + 436) * 0.054));
    expect(box.left).toBeGreaterThan(0);
    expect(letteringBox("Barranquilla", 54).width).toBeGreaterThan(box.width);
  });

  it("only a city the font can write", () => {
    expect(letterable("Cúcuta")).toBe(true);
    expect(letterable("Bogotá D.C.")).toBe(true);
    expect(letterable("Łódź")).toBe(false);
    expect(letterable("")).toBe(false);
    expect(letterable("x".repeat(33))).toBe(false);
  });

  it("is signed: its image draws only what we asked for", () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const lettering = cityLettering("https://nailfest.lat", " Cúcuta ")!;
    const url = new URL(lettering.url);
    expect(url.pathname).toBe("/api/correo/ciudad");
    expect(url.searchParams.get("c")).toBe("Cúcuta");
    expect(letteringSigned("Cúcuta", url.searchParams.get("s")!)).toBe(true);
    expect(letteringSigned("Bogotá", url.searchParams.get("s")!)).toBe(false);
    expect(letteringSigned("Cúcuta", "otra")).toBe(false);
    const { width, height } = letteringBox("Cúcuta", 54);
    expect(lettering).toMatchObject({ width, height });
  });

  it("stays text without its secret or with a letter the font doesn't have", () => {
    vi.stubEnv("APP_SECRET_KEY", "");
    expect(cityLettering("https://nailfest.lat", "Cúcuta")).toBeNull();
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    expect(cityLettering("https://nailfest.lat", "Łódź")).toBeNull();
  });
});
