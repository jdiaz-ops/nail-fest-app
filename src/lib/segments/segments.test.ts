import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ people: [{ id: "p1" }, { id: "p2" }, { id: "p3" }] }));

vi.mock("@/lib/db", () => ({
  db: {
    person: {
      findMany: async ({ where }: { where?: { id?: { in?: string[] } } } = {}) =>
        state.people.filter((p) => !where?.id?.in || where.id.in.includes(p.id)),
      count: async ({ where }: { where?: { id?: { notIn?: string[] } } } = {}) =>
        state.people.filter((p) => !where?.id?.notIn?.includes(p.id)).length,
    },
  },
}));

import { countSegment, resolveSegment } from "./builder";
import { normalizeFilter } from "./normalize";
import { matchRange, personSearchWhere } from "./personSearch";
import { filterSchema } from "./schema";

describe("person segment condition", () => {
  it("is accepted from the composer, but never empty", () => {
    expect(filterSchema.safeParse({ include: [{ field: "person", personIds: ["p1"] }], exclude: [] }).success).toBe(true);
    expect(filterSchema.safeParse({ include: [{ field: "person", personIds: [] }], exclude: [] }).success).toBe(false);
  });

  it("survives normalization next to the older shapes", () => {
    const filter = normalizeFilter({
      include: [{ field: "person", personIds: ["p1", "p2"] }, { field: "city", city: "Bogotá" } as never],
      exclude: [{ field: "person", personIds: ["p2"] }],
    });
    expect(filter.include).toEqual([
      { field: "person", personIds: ["p1", "p2"] },
      { field: "city", cities: ["Bogotá"] },
    ]);
    expect(filter.exclude).toEqual([{ field: "person", personIds: ["p2"] }]);
  });

  it("on its own, the segment is exactly those people — minus anyone no longer in the CRM", async () => {
    const filter = { include: [{ field: "person" as const, personIds: ["p1", "p3", "gone"] }], exclude: [] };
    expect((await resolveSegment(filter)).map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(await countSegment(filter)).toBe(2);
  });

  it("in exclude, takes them out of a bigger segment", async () => {
    const filter = { include: [], exclude: [{ field: "person" as const, personIds: ["p2"] }] };
    expect((await resolveSegment(filter)).map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(await countSegment(filter)).toBe(2);
  });
});

describe("personSearchWhere", () => {
  it("waits for a few characters", () => {
    expect(personSearchWhere("  31 ")).toBeNull();
  });

  it("matches a phone by its digits, however it's typed", () => {
    expect(personSearchWhere("+57 313-241")?.OR).toContainEqual({ phone: { contains: "57313241" } });
    expect(personSearchWhere("313 241")?.OR).toContainEqual({ phone: { contains: "313241" } });
  });

  it("matches an email or a name, without a phone clause for too few digits", () => {
    const or = personSearchWhere("laura.gomez@")?.OR ?? [];
    expect(or).toContainEqual({ email: { contains: "laura.gomez@", mode: "insensitive" } });
    expect(or.some((clause) => "phone" in clause)).toBe(false);
  });

  it("matches a first and last name typed together", () => {
    expect(personSearchWhere("Laura Gómez")?.OR).toContainEqual({
      AND: [
        { firstName: { contains: "Laura", mode: "insensitive" } },
        { lastName: { contains: "Gómez", mode: "insensitive" } },
      ],
    });
  });
});

describe("matchRange", () => {
  it("finds the query as typed, ignoring case", () => {
    expect(matchRange("Laura.Gomez@ejemplo.com", "GOMEZ")).toEqual([6, 11]);
    expect(matchRange("+57 313 241 0001", "313 241")).toEqual([4, 11]);
  });

  it("finds a phone's digits across whatever grouping it's displayed with", () => {
    expect(matchRange("+57 313 241 0001", "3132410001")).toEqual([4, 16]);
    expect(matchRange("+573132410001", "313 241")).toEqual([3, 9]);
  });

  it("finds nothing when there's nothing to find", () => {
    expect(matchRange("Laura", "zzz")).toBeNull();
    expect(matchRange("+57 313 241 0001", "999")).toBeNull();
  });
});
