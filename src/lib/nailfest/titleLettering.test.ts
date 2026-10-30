import { afterEach, describe, expect, it, vi } from "vitest";
import { eventHeadingOf, letterable, lettering, letteringBox, letteringSigned } from "./titleLettering";

describe("the header's name and days as the event's page writes them", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("take the box of their strokes, the «y»'s tail under the line included", () => {
    const days = letteringBox("dias", "7 y 8");
    // From the 8's top (0.720 em) to the y's tail (0.233 em under the line), and a margin of 0.12 em on each side.
    expect(days.height).toBe(Math.ceil((720 + 233) * 0.052) + 2 * Math.ceil(120 * 0.052));
    expect(days.left).toBeGreaterThan(0);
    expect(letteringBox("nombre", "Nail Fest Barranquilla").width).toBeGreaterThan(letteringBox("nombre", "Nail Fest Cúcuta").width);
  });

  it("only what the font can write", () => {
    expect(letterable("Nail Fest Cúcuta")).toBe(true);
    expect(letterable("30 – 1")).toBe(true);
    expect(letterable("Łódź")).toBe(false);
    expect(letterable(" ")).toBe(false);
    expect(letterable("x".repeat(49))).toBe(false);
  });

  it("are signed: their image draws only what we asked for", () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const name = lettering("https://nailfest.lat", "nombre", " Nail Fest Cúcuta ")!;
    const url = new URL(name.url);
    expect(url.pathname).toBe("/api/correo/titulo");
    expect(url.searchParams.get("k")).toBe("nombre");
    expect(url.searchParams.get("t")).toBe("Nail Fest Cúcuta");
    const s = url.searchParams.get("s")!;
    expect(letteringSigned("nombre", "Nail Fest Cúcuta", s)).toBe(true);
    expect(letteringSigned("dias", "Nail Fest Cúcuta", s)).toBe(false);
    expect(letteringSigned("nombre", "Nail Fest Bogotá", s)).toBe(false);
    const { width, height } = letteringBox("nombre", "Nail Fest Cúcuta");
    expect(name).toMatchObject({ width, height });
  });

  it("stay text without the secret", () => {
    vi.stubEnv("APP_SECRET_KEY", "");
    expect(lettering("https://nailfest.lat", "dias", "7 y 8")).toBeNull();
  });

  it("an event's header: its name, the big days and the rest of its date", () => {
    vi.stubEnv("APP_SECRET_KEY", "secreto-de-prueba");
    const heading = eventHeadingOf(
      "https://nailfest.lat",
      { name: "Nail Fest Cúcuta", startsAt: new Date("2026-11-07T15:00:00Z"), endsAt: new Date("2026-11-08T22:00:00Z") },
      "America/Bogota",
      "es"
    );
    expect(heading).toMatchObject({ name: "Nail Fest Cúcuta", days: "7 y 8", month: "de noviembre", detail: "Sábado y domingo · 2026" });
    expect(heading.nameImage?.url).toContain("k=nombre");
    expect(heading.daysImage?.url).toContain("t=7%20y%208");
  });
});
