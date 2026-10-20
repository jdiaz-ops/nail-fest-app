import { describe, expect, it } from "vitest";
import { listSlug } from "./lists";

describe("listSlug", () => {
  it.each([
    ["Para empezar en acrílico", "para-empezar-en-acrilico"],
    ["  Lo más   vendido!! ", "lo-mas-vendido"],
    ["¿?", "lista"],
  ])("%s → %s", (title, slug) => {
    expect(listSlug(title)).toBe(slug);
  });
});
