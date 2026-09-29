import { describe, expect, it, vi } from "vitest";

const taken = vi.hoisted(() => ({ slugs: new Set<string>() }));
vi.mock("@/lib/db", () => ({
  db: {
    infoPage: {
      findFirst: async ({ where }: { where: { slug: string } }) => (taken.slugs.has(where.slug) ? { id: "x" } : null),
    },
  },
}));
vi.mock("@/lib/sanitizeHtml", () => ({ sanitizeEventDescription: (s: string) => s }));
vi.mock("@/lib/ticketTypes", () => ({ createTicketType: vi.fn() }));

import { uniqueInfoPageSlug } from "./infoPages";

describe("uniqueInfoPageSlug", () => {
  it("builds a clean address from the title", async () => {
    taken.slugs = new Set();
    expect(await uniqueInfoPageSlug("ev", "Cronograma de Demostraciones")).toBe("cronograma-de-demostraciones");
    expect(await uniqueInfoPageSlug("ev", "  El Lugar ¡Hotel Casino!  ")).toBe("el-lugar-hotel-casino");
  });

  it("never takes a route the event page already uses", async () => {
    taken.slugs = new Set();
    expect(await uniqueInfoPageSlug("ev", "pago")).toBe("pago-info");
  });

  it("adds -2, -3 when the event already has that page", async () => {
    taken.slugs = new Set(["horarios", "horarios-2"]);
    expect(await uniqueInfoPageSlug("ev", "Horarios")).toBe("horarios-3");
  });

  it("falls back to 'pagina' for a title with nothing usable", async () => {
    taken.slugs = new Set();
    expect(await uniqueInfoPageSlug("ev", "¡¡¡")).toBe("pagina");
  });
});
