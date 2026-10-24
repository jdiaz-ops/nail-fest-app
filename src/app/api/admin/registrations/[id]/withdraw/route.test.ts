import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ requireUser }));

const { findConversation } = vi.hoisted(() => ({ findConversation: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { whatsAppConversation: { findUnique: findConversation } } }));

const { addNote } = vi.hoisted(() => ({ addNote: vi.fn() }));
vi.mock("@/lib/whatsapp/notes", () => ({ addNote }));

const { withdrawRegistration, restoreRegistration } = vi.hoisted(() => ({ withdrawRegistration: vi.fn(), restoreRegistration: vi.fn() }));
vi.mock("@/lib/registrationWithdrawal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/registrationWithdrawal")>()),
  withdrawRegistration,
  restoreRegistration,
}));

import { WithdrawalError } from "@/lib/registrationWithdrawal";
import { POST } from "./route";

const OK_AUTH = { user: { id: "u1", username: "juan", name: "Juan", role: "COORDINADOR" } };
const done = (changed = true) => ({ registration: { id: "r1", event: { name: "Nail Fest Cúcuta" } }, changed });

function tap(body: unknown) {
  return POST(new NextRequest("http://localhost/api/admin/registrations/r1/withdraw", { method: "POST", body: JSON.stringify(body) }), { params: { id: "r1" } });
}

beforeEach(() => {
  requireUser.mockReset().mockResolvedValue(OK_AUTH);
  findConversation.mockReset().mockResolvedValue({ id: "c1" });
  addNote.mockReset();
  withdrawRegistration.mockReset().mockResolvedValue(done());
  restoreRegistration.mockReset().mockResolvedValue(done());
});

describe("POST /api/admin/registrations/[id]/withdraw", () => {
  it("takes them out as the one who tapped, and notes it in the chat", async () => {
    const res = await tap({ conversationId: "c1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: "out" });
    expect(withdrawRegistration).toHaveBeenCalledWith("r1", "u1");
    expect(addNote).toHaveBeenCalledWith("c1", "u1", expect.stringContaining("Se retiró de «Nail Fest Cúcuta»"));
  });

  it("undoes it, with its own note", async () => {
    const res = await tap({ undo: true, conversationId: "c1" });
    expect(await res.json()).toEqual({ ok: true, state: "in" });
    expect(restoreRegistration).toHaveBeenCalledWith("r1");
    expect(addNote).toHaveBeenCalledWith("c1", "u1", expect.stringContaining("Se deshizo el retiro"));
  });

  it("adds no note for a tap that changed nothing, or outside a chat", async () => {
    withdrawRegistration.mockResolvedValue(done(false));
    await tap({ conversationId: "c1" });
    withdrawRegistration.mockResolvedValue(done());
    await tap({});
    expect(addNote).not.toHaveBeenCalled();
  });

  it("says why it can't, in words", async () => {
    withdrawRegistration.mockRejectedValue(new WithdrawalError("Ya entró al evento: no se puede retirar."));
    const res = await tap({});
    expect(res.status).toBe(409);
    expect((await res.json()).message).toBe("Ya entró al evento: no se puede retirar.");
  });

  it("is for the team only", async () => {
    requireUser.mockResolvedValue({ response: new Response(null, { status: 403 }) });
    const res = await tap({});
    expect(res.status).toBe(403);
    expect(withdrawRegistration).not.toHaveBeenCalled();
  });
});
