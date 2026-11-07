import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser, segmentOfNotReached } = vi.hoisted(() => ({ requireUser: vi.fn(), segmentOfNotReached: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));
vi.mock("@/lib/whatsapp/notReached", async () => {
  class NotReachedError extends Error {}
  return { NotReachedError, segmentOfNotReached };
});

import { POST } from "./route";
import { NotReachedError } from "@/lib/whatsapp/notReached";

const call = () => POST(new Request("https://nailfest.lat/api/admin/whatsapp/broadcasts/w_1/no-recibieron", { method: "POST" }), { params: { id: "w_1" } });

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  segmentOfNotReached.mockReset().mockResolvedValue({ segmentId: "s1", segmentName: "Cel CO · sin domingo", audience: 10, received: 6, failed: 1, none: 3 });
});

describe("«Segmento: no la recibieron»", () => {
  it("makes the segment and says how it split", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, segmentName: "Cel CO · sin domingo", received: 6, failed: 1, none: 3 });
    expect(segmentOfNotReached).toHaveBeenCalledWith("w_1");
  });

  it("a difusión without a segment: says why", async () => {
    segmentOfNotReached.mockRejectedValue(new NotReachedError("Esto es para difusiones enviadas a un segmento."));
    const res = await call();
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("segmento");
  });

  it("only the team's admins", async () => {
    requireUser.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    expect((await call()).status).toBe(403);
    expect(segmentOfNotReached).not.toHaveBeenCalled();
  });
});
