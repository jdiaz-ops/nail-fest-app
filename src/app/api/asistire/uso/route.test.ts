import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

const db = vi.hoisted(() => ({
  event: { findUnique: vi.fn() },
  registration: { findUnique: vi.fn() },
  asistireUse: { upsert: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

process.env.APP_SECRET_KEY = "solo-para-pruebas";

import { asistireToken } from "@/lib/imparables/asistire";
import { asistireCounts } from "@/lib/asistireUse";
import { POST } from "./route";

// «Asistiré»'s count (lib/asistireUse.ts, 2026-11-01): people per step, by link.

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/asistire/uso", { method: "POST", body: JSON.stringify(body) }));
const VISITOR = "3f2a9c1e-5b7d-4e8a";

beforeEach(() => {
  db.event.findUnique.mockReset().mockResolvedValue({ id: "ev_cucuta" });
  db.registration.findUnique.mockReset().mockResolvedValue({ eventId: "ev_cucuta" });
  db.asistireUse.upsert.mockReset().mockResolvedValue({});
  db.asistireUse.update.mockReset().mockResolvedValue({});
  db.asistireUse.groupBy.mockReset();
});

describe("her own link", () => {
  it("counts her, by her registration, once per step: again only adds to how many times", async () => {
    const res = await post({ token: asistireToken("reg_1"), step: "CREATED", visitor: VISITOR });
    expect(res.status).toBe(204);
    expect(db.asistireUse.upsert).toHaveBeenCalledWith({
      where: { eventId_person_step: { eventId: "ev_cucuta", person: "r:reg_1", step: "CREATED" } },
      create: { eventId: "ev_cucuta", person: "r:reg_1", personal: true, step: "CREATED" },
      update: { times: { increment: 1 } },
    });
  });

  it("a registration that isn't there counts nothing", async () => {
    db.registration.findUnique.mockResolvedValue(null);
    expect((await post({ token: asistireToken("reg_x"), step: "DOWNLOADED" })).status).toBe(404);
    expect(db.asistireUse.upsert).not.toHaveBeenCalled();
  });
});

describe("the event's public link", () => {
  it("counts her browser, apart from the personal links", async () => {
    const res = await post({ token: asistireToken("muestra-ev_cucuta"), step: "DOWNLOADED", visitor: VISITOR });
    expect(res.status).toBe(204);
    expect(db.registration.findUnique).not.toHaveBeenCalled();
    expect(db.asistireUse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { eventId: "ev_cucuta", person: `v:${VISITOR}`, personal: false, step: "DOWNLOADED" } }),
    );
  });

  it("needs her browser's id", async () => {
    expect((await post({ token: asistireToken("muestra-ev_cucuta"), step: "CREATED" })).status).toBe(400);
    expect((await post({ token: asistireToken("muestra-ev_cucuta"), step: "CREATED", visitor: "a b" })).status).toBe(400);
    expect(db.asistireUse.upsert).not.toHaveBeenCalled();
  });
});

describe("anything else", () => {
  it("a link we didn't sign, or a step we don't count, counts nothing", async () => {
    expect((await post({ token: "reg_1.firma-falsa", step: "CREATED" })).status).toBe(404);
    expect((await post({ token: asistireToken("reg_1"), step: "SHARED" })).status).toBe(400);
    expect(db.asistireUse.upsert).not.toHaveBeenCalled();
  });

  it("the same step twice at once: the second adds to the first's row", async () => {
    db.asistireUse.upsert.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "5.22.0" }));
    expect((await post({ token: asistireToken("reg_1"), step: "CREATED" })).status).toBe(204);
    expect(db.asistireUse.update).toHaveBeenCalledWith({
      where: { eventId_person_step: { eventId: "ev_cucuta", person: "r:reg_1", step: "CREATED" } },
      data: { times: { increment: 1 } },
    });
  });
});

describe("the event's summary", () => {
  it("people per step, by link", async () => {
    db.asistireUse.groupBy.mockResolvedValue([
      { step: "CREATED", personal: true, _count: { _all: 12 } },
      { step: "CREATED", personal: false, _count: { _all: 30 } },
      { step: "DOWNLOADED", personal: true, _count: { _all: 9 } },
    ]);
    expect(await asistireCounts("ev_cucuta")).toEqual({ created: { personal: 12, public: 30 }, downloaded: { personal: 9, public: 0 } });
  });
});
