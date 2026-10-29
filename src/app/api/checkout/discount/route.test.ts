import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { findTicketType } = vi.hoisted(() => ({ findTicketType: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { ticketType: { findUnique: findTicketType } } }));

const { resolveDiscount } = vi.hoisted(() => ({ resolveDiscount: vi.fn() }));
vi.mock("@/lib/discounts", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/discounts")>()), resolveDiscount }));

import { POST } from "./route";

const ASK = { eventSlug: "manicuristas-imparables-2027", ticketTypeId: "t1", ticketCount: 2, code: "imparable10" };

function send(body: unknown) {
  return POST(new NextRequest("http://localhost/api/checkout/discount", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  findTicketType.mockReset().mockResolvedValue({ id: "t1", eventId: "e1", price: 80000, priceUsdCents: 2500, event: { slug: "manicuristas-imparables-2027", status: "PUBLISHED" } });
  resolveDiscount.mockReset().mockResolvedValue({ ok: true, discountCode: { code: "IMPARABLE10" }, discountCents: 16000_00, totalCents: 144000_00, label: "−10%" });
});

describe("POST /api/checkout/discount", () => {
  it("says what a code takes off this ticket times how many", async () => {
    const res = await send(ASK);
    expect(await res.json()).toEqual({ ok: true, code: "IMPARABLE10", label: "−10%", discountCents: 16000_00, totalCents: 144000_00 });
    expect(resolveDiscount).toHaveBeenCalledWith({ eventId: "e1", ticketTypeId: "t1", code: "imparable10", subtotalCents: 160000_00, currency: "COP" });
  });

  it("in dollars, on the ticket's own USD price", async () => {
    await send({ ...ASK, currency: "USD" });
    expect(resolveDiscount).toHaveBeenCalledWith({ eventId: "e1", ticketTypeId: "t1", code: "imparable10", subtotalCents: 50_00, currency: "USD" });
    findTicketType.mockResolvedValueOnce({ id: "t1", eventId: "e1", price: 80000, priceUsdCents: null, event: { slug: "manicuristas-imparables-2027", status: "PUBLISHED" } });
    expect(await (await send({ ...ASK, currency: "USD" })).json()).toMatchObject({ ok: false, error: "not_found" });
  });

  it("says why a code doesn't apply, as a normal answer", async () => {
    resolveDiscount.mockResolvedValueOnce({ ok: false, error: "expired" });
    const res = await send(ASK);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: false, error: "expired", message: "Ese código ya venció." });
  });

  it("knows no code for another event's ticket, or a free one", async () => {
    findTicketType.mockResolvedValueOnce({ id: "t1", eventId: "e2", price: 80000, event: { slug: "otro-evento", status: "PUBLISHED" } });
    expect(await (await send(ASK)).json()).toMatchObject({ ok: false, error: "not_found" });
    findTicketType.mockResolvedValueOnce({ id: "t1", eventId: "e1", price: 0, event: { slug: "manicuristas-imparables-2027", status: "PUBLISHED" } });
    expect(await (await send(ASK)).json()).toMatchObject({ ok: false, error: "not_found" });
    expect(resolveDiscount).not.toHaveBeenCalled();
  });
});
