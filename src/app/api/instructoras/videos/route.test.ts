import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  instructorVideoSubmission: { count: vi.fn(), create: vi.fn((args: unknown) => ({ op: "create", args })) },
  instructorAccount: { update: vi.fn((args: unknown) => ({ op: "terms", args })) },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}));
vi.mock("@/lib/db", () => ({ db }));
const { requirePortalUser } = vi.hoisted(() => ({ requirePortalUser: vi.fn() }));
vi.mock("@/lib/library/portalAuth", () => ({ requirePortalUser }));

import { POST } from "./route";

const VIDEO = { youtube: "https://youtube.com/shorts/dQw4w9WgXcQ", title: "Francesa invertida", theme: "tecnicas", level: "intermedio", products: "Marca · Polygel" };
const sendVideo = (body: unknown) => POST(new NextRequest("http://localhost/api/instructoras/videos", { method: "POST", body: JSON.stringify(body) }));
const user = (contentTermsAcceptedAt: Date | null) => ({ user: { instructor: { id: "i1" }, account: { id: "a1", contentTermsAcceptedAt } } });

beforeEach(() => {
  requirePortalUser.mockReset().mockResolvedValue(user(null));
  db.instructorVideoSubmission.count.mockReset().mockResolvedValue(0);
  db.$transaction.mockClear();
  db.instructorVideoSubmission.create.mockClear();
  db.instructorAccount.update.mockClear();
});

describe("POST /api/instructoras/videos", () => {
  it("her first video needs the content permission, and records it", async () => {
    let res = await sendVideo(VIDEO);
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toEqual(["acceptContent"]);

    res = await sendVideo({ ...VIDEO, acceptContent: true });
    expect(res.status).toBe(200);
    expect(db.instructorVideoSubmission.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ instructorId: "i1", youtubeId: "dQw4w9WgXcQ", products: ["Marca · Polygel"] }),
    });
    expect(db.instructorAccount.update).toHaveBeenCalledWith({ where: { id: "a1" }, data: { contentTermsAcceptedAt: expect.any(Date) } });
  });

  it("after that, no more asking", async () => {
    requirePortalUser.mockResolvedValue(user(new Date()));
    expect((await sendVideo(VIDEO)).status).toBe(200);
    expect(db.instructorAccount.update).not.toHaveBeenCalled();
  });

  it("five waiting for the team is the most", async () => {
    requirePortalUser.mockResolvedValue(user(new Date()));
    db.instructorVideoSubmission.count.mockResolvedValue(5);
    const res = await sendVideo(VIDEO);
    expect(res.status).toBe(429);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("a link that isn't YouTube is refused by its box", async () => {
    const res = await sendVideo({ ...VIDEO, youtube: "https://vimeo.com/123", acceptContent: true });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ fields: ["youtube"], message: "Pega el enlace de tu video en YouTube." });
  });
});
