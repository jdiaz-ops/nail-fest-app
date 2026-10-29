import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { findPayment, updateRegistration } = vi.hoisted(() => ({ findPayment: vi.fn(), updateRegistration: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { payment: { findUnique: findPayment }, registration: { update: updateRegistration } } }));

import { POST } from "./route";

function send(body: unknown) {
  return POST(new NextRequest("http://localhost/api/register/extra", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  findPayment.mockReset().mockResolvedValue({ registrationId: "reg_1", status: "APPROVED", registration: { customFields: { cedula: "1020304050" } } });
  updateRegistration.mockReset().mockResolvedValue({});
});

describe("POST /api/register/extra", () => {
  it("saves the Instagram of that registration's own approved payment, keeping its other answers", async () => {
    const res = await send({ registrationId: "reg_1", transactionId: "1234-1761745200-49201", instagram: "@maria.nails" });
    expect(res.status).toBe(200);
    expect(findPayment).toHaveBeenCalledWith(expect.objectContaining({ where: { providerReference: "1234-1761745200-49201" } }));
    expect(updateRegistration).toHaveBeenCalledWith({ where: { id: "reg_1" }, data: { customFields: { cedula: "1020304050", instagram: "@maria.nails" } } });
  });

  it("changes nothing for another registration's payment, or one not approved", async () => {
    expect((await send({ registrationId: "reg_2", transactionId: "1234-1761745200-49201", instagram: "@x" })).status).toBe(404);
    findPayment.mockResolvedValueOnce({ registrationId: "reg_1", status: "PENDING", registration: { customFields: null } });
    expect((await send({ registrationId: "reg_1", transactionId: "1234-1761745200-49201", instagram: "@x" })).status).toBe(404);
    findPayment.mockResolvedValueOnce(null);
    expect((await send({ registrationId: "reg_1", transactionId: "no-such-transaction", instagram: "@x" })).status).toBe(404);
    expect(updateRegistration).not.toHaveBeenCalled();
  });
});
