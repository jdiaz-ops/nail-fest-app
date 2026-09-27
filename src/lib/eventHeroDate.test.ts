import { describe, expect, it } from "vitest";
import { formatHeroDate } from "./eventHeroDate";

const tz = "America/Bogota";
// 10:00 Bogotá = 15:00Z
const bogota = (iso: string) => new Date(`${iso}T15:00:00Z`);

describe("formatHeroDate", () => {
  it("two consecutive days in the same month", () => {
    expect(formatHeroDate(bogota("2026-11-07"), bogota("2026-11-08"), tz, "es")).toEqual({
      days: "7 y 8",
      month: "de noviembre",
      detail: "Sábado y domingo · 2026",
    });
  });

  it("a single day (no end date)", () => {
    expect(formatHeroDate(bogota("2026-11-07"), null, tz, "es")).toEqual({
      days: "7",
      month: "de noviembre",
      detail: "Sábado · 2026",
    });
  });

  it("an end date on the same calendar day counts as a single day", () => {
    expect(formatHeroDate(bogota("2026-11-07"), new Date("2026-11-07T23:00:00Z"), tz, "es").days).toBe("7");
  });

  it("a span of three or more days reads 'al'", () => {
    expect(formatHeroDate(bogota("2026-11-06"), bogota("2026-11-08"), tz, "es")).toEqual({
      days: "6 al 8",
      month: "de noviembre",
      detail: "Viernes a domingo · 2026",
    });
  });

  it("a span across two months names both", () => {
    expect(formatHeroDate(bogota("2026-10-31"), bogota("2026-11-01"), tz, "es")).toEqual({
      days: "31 – 1",
      month: "de octubre a noviembre",
      detail: "Sábado y domingo · 2026",
    });
  });

  it("uses the org timezone, not UTC, to pick the day", () => {
    // 23:30 Bogotá on the 7th is already the 8th in UTC.
    expect(formatHeroDate(new Date("2026-11-08T04:30:00Z"), null, tz, "es").days).toBe("7");
  });
});
