import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  emailBroadcast: { findMany: vi.fn() },
  mesaEditionLayout: { findUnique: vi.fn(), upsert: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/imparables/promo", () => ({ imparablesPromo: vi.fn() }));

import { MesaError, editionLayout, saveEditionLayout } from "./data";

const sendOf = (edition: number, status: string) => [{ id: "b1", mesaEdition: edition, status, scheduledAt: null, sentAt: null, segmentId: null, segment: null }];

beforeEach(() => {
  db.emailBroadcast.findMany.mockReset().mockResolvedValue([]);
  db.mesaEditionLayout.findUnique.mockReset().mockResolvedValue(null);
  db.mesaEditionLayout.upsert.mockReset().mockResolvedValue({});
});

describe("an edition's blocks, saved", () => {
  it("no row: the template's order and no banner", async () => {
    expect(await editionLayout(3)).toEqual({ blocks: ["JUEGO", "IMPARABLES", "TERMOMETRO", "OFICIO", "CONSULTORIO"], imparables: false });
  });

  it("a new order keeps the banner as it was, and the banner keeps the order", async () => {
    db.mesaEditionLayout.findUnique.mockResolvedValue({ edition: 3, blocks: ["TERMOMETRO", "JUEGO", "OFICIO", "IMPARABLES", "CONSULTORIO"], imparables: true });
    await saveEditionLayout(3, { blocks: ["OFICIO", "JUEGO", "TERMOMETRO", "IMPARABLES", "CONSULTORIO"] });
    expect(db.mesaEditionLayout.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { edition: 3 }, update: { blocks: ["OFICIO", "JUEGO", "TERMOMETRO", "IMPARABLES", "CONSULTORIO"], imparables: true } }),
    );
    await saveEditionLayout(3, { imparables: false });
    expect(db.mesaEditionLayout.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ update: { blocks: ["TERMOMETRO", "JUEGO", "OFICIO", "IMPARABLES", "CONSULTORIO"], imparables: false } }),
    );
  });

  it("while it's scheduled, yes; once it starts going out, no", async () => {
    db.emailBroadcast.findMany.mockResolvedValue(sendOf(3, "QUEUED"));
    await expect(saveEditionLayout(3, { imparables: true })).resolves.toBeUndefined();
    db.emailBroadcast.findMany.mockResolvedValue(sendOf(3, "SENDING"));
    await expect(saveEditionLayout(3, { imparables: true })).rejects.toThrow(MesaError);
    db.emailBroadcast.findMany.mockResolvedValue(sendOf(3, "SENT"));
    await expect(saveEditionLayout(3, { blocks: ["OFICIO"] })).rejects.toThrow("ya salió");
    expect(db.mesaEditionLayout.upsert).toHaveBeenCalledTimes(1);
  });

  it("an order it doesn't understand, no", async () => {
    await expect(saveEditionLayout(3, { blocks: ["JUEGO", "PORTADA"] })).rejects.toThrow(MesaError);
    await expect(saveEditionLayout(0, { imparables: true })).rejects.toThrow(MesaError);
    expect(db.mesaEditionLayout.upsert).not.toHaveBeenCalled();
  });
});
