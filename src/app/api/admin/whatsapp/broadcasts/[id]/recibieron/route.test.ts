import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, segmentOfReached } = vi.hoisted(() => ({ requireUser: vi.fn(), segmentOfReached: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
vi.mock("@/lib/whatsapp/notReached", async () => {
  class NotReachedError extends Error {}
  return { NotReachedError, segmentOfReached };
});

import { POST } from "./route";
import { NotReachedError } from "@/lib/whatsapp/notReached";

const call = () => POST(new Request("https://nailfest.lat/api/admin/whatsapp/broadcasts/w_1/recibieron", { method: "POST" }), { params: { id: "w_1" } });

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  segmentOfReached.mockReset().mockResolvedValue({ segmentId: "s2", segmentName: "Cel CO · recibieron domingo", audience: 10, received: 6 });
});

describe("«Segmento: la recibieron»", () => {
  it("makes the segment of the ones it reached", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, segmentName: "Cel CO · recibieron domingo", received: 6 });
  });

  it("nobody got it, or no segment: says why", async () => {
    segmentOfReached.mockRejectedValue(new NotReachedError("Nadie de su segmento la recibió todavía."));
    const res = await call();
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("Nadie");
  });

  it("only the team's admins", async () => {
    requireUser.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(segmentOfReached).not.toHaveBeenCalled();
  });
});
