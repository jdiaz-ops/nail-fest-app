import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Event } from "@prisma/client";
import type { LibraryConfig } from "@/lib/library/settings";
import type { LibraryViewer } from "@/lib/library/data";
import type { ConsultorioIdentity } from "./auth";

const db = vi.hoisted(() => ({ cuponeraBrand: { findMany: vi.fn() }, event: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ db }));
const cuponera = vi.hoisted(() => ({ getCuponeraSettings: vi.fn() }));
vi.mock("@/lib/cuponera/settings", () => cuponera);
const library = vi.hoisted(() => ({ getShorties: vi.fn(), getCortosTopics: vi.fn(), getInstructorCards: vi.fn() }));
vi.mock("@/lib/library/data", () => library);
const consultorio = vi.hoisted(() => ({ countQuestions: vi.fn(), latestQuestions: vi.fn() }));
vi.mock("./data", () => consultorio);

import { communityAccountLink, communityMenuLinks, getCommunityHome } from "./home";

function viewer(staff: boolean, config: Partial<LibraryConfig> = {}): LibraryViewer {
  return {
    staff,
    cuponeraLive: staff,
    unlocked: staff,
    config: { published: false, instructorsPublished: false, portalOpen: false, consultorioPublished: false, sections: { shorties: true }, ...config } as LibraryConfig,
  };
}

const corto = (slug: string, sample = false) => ({ video: { slug, title: slug, youtubeId: null, durationSeconds: 42, instructor: null, sample } });
const EVENTS = [{ id: "next", slug: "cucuta" }, { id: "e2", slug: "bogota" }];

beforeEach(() => {
  vi.clearAllMocks();
  cuponera.getCuponeraSettings.mockResolvedValue({ published: false });
  db.cuponeraBrand.findMany.mockResolvedValue([{ id: "b1", name: "Masglo", logoUrl: null, discountPercent: 15 }]);
  db.event.findMany.mockResolvedValue(EVENTS);
  library.getShorties.mockResolvedValue([corto("a", true), corto("b", true)]);
  library.getCortosTopics.mockResolvedValue([]);
  library.getInstructorCards.mockResolvedValue([{ slug: "ana", sample: true }]);
  consultorio.countQuestions.mockResolvedValue(0);
  consultorio.latestQuestions.mockResolvedValue([]);
});

describe("the community's home", () => {
  it("shows the public only what's public — the next events always", async () => {
    const home = await getCommunityHome(viewer(false), "next");
    expect([home.cortos.show, home.library.show, home.cuponera.show, home.instructors.show, home.consultorio.show]).toEqual([false, false, false, false, false]);
    expect(library.getShorties).not.toHaveBeenCalled();
    expect(consultorio.latestQuestions).not.toHaveBeenCalled();
    expect(home.moreEvents.map((e) => e.id)).toEqual(["e2"]);
  });

  it("the team sees every part, to preview it — examples included", async () => {
    const home = await getCommunityHome(viewer(true), "next");
    expect([home.cortos.show, home.library.show, home.cuponera.show, home.instructors.show, home.consultorio.show]).toEqual([true, true, true, true, true]);
    expect(home.cortos.count).toBe(0);
    expect(home.cortos.items).toHaveLength(2);
    expect(consultorio.latestQuestions).toHaveBeenCalledWith(3);
  });

  it("the cortos once there are three real ones; the cuponera once it's out and has a brand", async () => {
    const published = viewer(false, { published: true, consultorioPublished: true });
    library.getShorties.mockResolvedValue([corto("a"), corto("b")]);
    expect((await getCommunityHome(published, null)).cortos.show).toBe(false);
    library.getShorties.mockResolvedValue([corto("a"), corto("b"), corto("c")]);
    cuponera.getCuponeraSettings.mockResolvedValue({ published: true });
    const home = await getCommunityHome(published, null);
    expect(home.cortos).toMatchObject({ show: true, count: 3 });
    expect(home.cuponera).toMatchObject({ show: true, count: 1, brands: [{ name: "Masglo", initial: "M", discountPercent: 15 }] });
    expect(home.consultorio.show).toBe(true);
    db.cuponeraBrand.findMany.mockResolvedValue([]);
    expect((await getCommunityHome(published, null)).cuponera.show).toBe(false);
  });
});

describe("the community's menu", () => {
  const NEXT = { slug: "cucuta", name: "Nail Fest Cúcuta", publicName: null } as Event;
  const SOME = { cortos: true, cuponera: false, consultorio: true, instructors: true, library: false };

  it("the home when it's on, the next event, then each part that's open", () => {
    expect(communityMenuLinks(SOME, NEXT, "/").map((l) => `${l.label} ${l.href}`)).toEqual([
      "Inicio /",
      "Nail Fest Cúcuta /cucuta",
      "Cortos /biblioteca/cortos",
      "Consultorio /consultorio",
      "Instructoras /instructoras",
    ]);
    expect(communityMenuLinks(SOME, null, null).map((l) => l.href)).toEqual(["/biblioteca/cortos", "/consultorio", "/instructoras"]);
  });

  it("her way in: her account, her portal, or «Entrar» once the Consultorio is open", () => {
    expect(communityAccountLink({ kind: "MEMBER" } as ConsultorioIdentity, true)?.href).toBe("/cuenta");
    expect(communityAccountLink({ kind: "INSTRUCTOR" } as ConsultorioIdentity, true)?.href).toBe("/instructoras/portal");
    expect(communityAccountLink(null, true)?.href).toBe("/cuenta/entrar?volver=/consultorio");
    expect(communityAccountLink(null, false)).toBeNull();
    expect(communityAccountLink({ kind: "TEAM" } as ConsultorioIdentity, true)).toBeNull();
  });
});
