import { describe, expect, it } from "vitest";
import { publicEventName } from "./eventDisplayName";

describe("publicEventName", () => {
  it("uses the public name when set", () => {
    expect(publicEventName({ name: "Cúcuta interno", publicName: "Nail Fest Cúcuta 2026" })).toBe("Nail Fest Cúcuta 2026");
  });
  it("falls back to the internal name when empty or missing", () => {
    expect(publicEventName({ name: "Nail Fest Cali", publicName: "  " })).toBe("Nail Fest Cali");
    expect(publicEventName({ name: "Nail Fest Cali", publicName: null })).toBe("Nail Fest Cali");
    expect(publicEventName({ name: "Nail Fest Cali" })).toBe("Nail Fest Cali");
  });
});
