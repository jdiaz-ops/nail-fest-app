import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
const tx = vi.hoisted(() => ({
  instructorVideoSubmission: { updateMany: vi.fn(), update: vi.fn() },
  libraryVideo: { create: vi.fn() },
}));
const db = vi.hoisted(() => ({
  instructorVideoSubmission: { findUnique: vi.fn(), updateMany: vi.fn() },
  libraryVideo: { findUnique: vi.fn(async () => null) },
  $transaction: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db }));

import { POST } from "./route";

const SUBMISSION = {
  id: "s1",
  instructorId: "i1",
  youtubeId: "dQw4w9WgXcQ",
  title: "Francesa invertida",
  theme: "tecnicas",
  level: "intermedio",
  description: "Para empezar.",
  products: ["Marca · Polygel natural", "Top coat"],
  status: "PENDING",
};
const review = (action: string) => POST(new NextRequest("http://localhost/api/admin/library/submissions/s1", { method: "POST", body: JSON.stringify({ action }) }), { params: { id: "s1" } });

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  db.instructorVideoSubmission.findUnique.mockReset().mockResolvedValue(SUBMISSION);
  db.instructorVideoSubmission.updateMany.mockReset();
  db.$transaction.mockReset().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
  tx.instructorVideoSubmission.updateMany.mockReset().mockResolvedValue({ count: 1 });
  tx.instructorVideoSubmission.update.mockReset();
  tx.libraryVideo.create.mockReset().mockResolvedValue({ id: "v1" });
});

describe("POST /api/admin/library/submissions/[id]", () => {
  it("«Aceptar y editar»: a hidden library video with her ficha, linked to what she sent", async () => {
    const res = await review("accept");
    expect(await res.json()).toEqual({ ok: true, videoId: "v1" });
    expect(tx.libraryVideo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: "francesa-invertida",
        title: "Francesa invertida",
        youtubeId: "dQw4w9WgXcQ",
        instructorId: "i1",
        visible: false,
        products: [
          { cuponeraProductId: null, brand: "Marca", name: "Polygel natural" },
          { cuponeraProductId: null, brand: "", name: "Top coat" },
        ],
      }),
    });
    expect(tx.instructorVideoSubmission.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { videoId: "v1" } });
  });

  it("«No seleccionar» closes it", async () => {
    expect((await review("decline")).status).toBe(200);
    expect(db.instructorVideoSubmission.updateMany).toHaveBeenCalledWith({ where: { id: "s1", status: "PENDING" }, data: { status: "DECLINED", reviewedAt: expect.any(Date) } });
  });

  it("one already reviewed — or reviewed by a teammate a moment before — isn't made twice", async () => {
    db.instructorVideoSubmission.findUnique.mockResolvedValueOnce({ ...SUBMISSION, status: "DECLINED" });
    expect((await review("accept")).status).toBe(409);

    tx.instructorVideoSubmission.updateMany.mockResolvedValueOnce({ count: 0 });
    expect((await review("accept")).status).toBe(409);
    expect(tx.libraryVideo.create).not.toHaveBeenCalled();
  });

  it("only for ADMIN", async () => {
    requireUser.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await review("accept")).status).toBe(403);
  });
});
