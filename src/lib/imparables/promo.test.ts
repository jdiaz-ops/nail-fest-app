import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, getActiveStage, getOrgSettings } = vi.hoisted(() => ({
  db: { event: { findMany: vi.fn() } },
  getActiveStage: vi.fn(),
  getOrgSettings: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/settings", () => ({ getOrgSettings }));
vi.mock("./pricing", () => ({ getActiveStage }));

import { imparablesPromo, ticketBannerFor } from "./promo";

const congress = (id: string, slug: string) => ({
  id,
  slug,
  format: "VIRTUAL",
  venueName: null,
  city: null,
  startsAt: new Date("2027-07-04T13:00:00Z"),
  endsAt: new Date("2027-07-04T23:30:00Z"),
  scheduleDays: null,
});
const nailFest = { slug: "bogota-2026", theme: "NAIL_FEST", imparablesTicketBanner: true };

beforeEach(() => {
  vi.stubEnv("APP_BASE_URL", "https://nailfest.lat");
  db.event.findMany.mockReset().mockResolvedValue([congress("c1", "imparables")]);
  getActiveStage.mockReset().mockResolvedValue({ mode: "sale" });
  getOrgSettings.mockReset().mockResolvedValue({ timezone: "America/Bogota" });
});

describe("the congress the banners send people to", () => {
  it("is the next published one still to come whose sales haven't closed, with its day", async () => {
    db.event.findMany.mockResolvedValue([congress("c0", "imparables-cerrado"), congress("c1", "imparables")]);
    getActiveStage.mockImplementation(async (event: { id: string }) => ({ mode: event.id === "c0" ? "closed" : "waitlist" }));
    expect(await imparablesPromo(new Date("2026-11-04T12:00:00Z"))).toEqual({ slug: "imparables", date: "4 de julio 2027", note: "Congreso virtual en vivo" });
    expect(db.event.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { theme: "IMPARABLES", status: "PUBLISHED", startsAt: { gt: new Date("2026-11-04T12:00:00Z") } } }));
  });

  it("is none once its sales close", async () => {
    getActiveStage.mockResolvedValue({ mode: "closed" });
    expect(await imparablesPromo()).toBeNull();
  });
});

describe("an event's tickets' banner", () => {
  it("opens the congress's page, tagged as coming from this event's ticket", async () => {
    const banner = await ticketBannerFor(nailFest);
    expect(banner).toEqual({ url: expect.any(String), date: "4 de julio 2027", note: "Congreso virtual en vivo" });
    const url = new URL(banner!.url);
    expect(url.origin + url.pathname).toBe("https://nailfest.lat/imparables");
    expect(Object.fromEntries(url.searchParams)).toEqual({ utm_source: "nailfest", utm_medium: "pdf_entrada", utm_campaign: "bogota-2026", utm_content: "banner_imparables" });
  });

  it("only with its switch on (or the admin's look at it), never on the congress's own tickets", async () => {
    expect(await ticketBannerFor({ ...nailFest, imparablesTicketBanner: false })).toBeNull();
    expect(await ticketBannerFor({ slug: "bogota-2026" })).toBeNull();
    expect(await ticketBannerFor({ ...nailFest, imparablesTicketBanner: false }, { force: true })).not.toBeNull();
    expect(await ticketBannerFor({ ...nailFest, theme: "IMPARABLES" }, { force: true })).toBeNull();
    expect(db.event.findMany).toHaveBeenCalledTimes(1);
  });

  it("not while there's no congress on sale, switch on or not", async () => {
    db.event.findMany.mockResolvedValue([]);
    expect(await ticketBannerFor(nailFest)).toBeNull();
  });
});
