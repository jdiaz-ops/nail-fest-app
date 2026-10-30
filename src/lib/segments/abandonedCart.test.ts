import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/settings", () => ({ getOrgSettings: async () => ({ bannedEmails: [] }) }));

import { cartStage, trulyAbandoned, type CartRow } from "./abandonedCart";
import { normalizeFilter } from "./normalize";
import { filterSchema } from "./schema";

const NOW = new Date("2026-10-30T15:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

let n = 0;
function cart(over: Partial<CartRow> & { email?: string; phone?: string | null; firstName?: string | null; lastName?: string | null } = {}): CartRow {
  n += 1;
  const { email, phone, firstName, lastName, ...rest } = over;
  return {
    personId: `p${n}`,
    eventId: "ev1",
    status: "STARTED",
    createdAt: ago(120),
    person: { email: email ?? `persona${n}@correo.com`, phone: phone ?? null, firstName: firstName ?? null, lastName: lastName ?? null },
    payments: [],
    ...rest,
  };
}
const buyer = (email: string, more: { phone?: string; firstName?: string; lastName?: string; eventId?: string } = {}) => ({
  eventId: more.eventId ?? "ev1",
  person: { email, phone: more.phone ?? null, firstName: more.firstName ?? null, lastName: more.lastName ?? null },
});
const run = (carts: CartRow[], buyers: ReturnType<typeof buyer>[] = [], stages: ("form" | "payment" | "declined")[] = [], blocked: string[] = []) =>
  trulyAbandoned(carts, buyers, { now: NOW, stages, blocked });

describe("where a cart stopped", () => {
  it("the form, a payment with no answer, or a payment turned down", () => {
    expect(cartStage({ status: "STARTED", createdAt: ago(90), payments: [] })).toEqual({ stage: "form", since: ago(90) });
    expect(cartStage({ status: "PENDING_PAYMENT", createdAt: ago(90), payments: [] })).toEqual({ stage: "payment", since: ago(90) });
    expect(cartStage({ status: "PENDING_PAYMENT", createdAt: ago(90), payments: [{ status: "PENDING", updatedAt: ago(80) }] })).toEqual({
      stage: "payment",
      since: ago(80),
    });
    expect(
      cartStage({ status: "PENDING_PAYMENT", createdAt: ago(90), payments: [{ status: "DECLINED", updatedAt: ago(70) }, { status: "PENDING", updatedAt: ago(85) }] })
    ).toEqual({ stage: "declined", since: ago(70) });
  });

  it("isn't one once paid, or for a registration that isn't a cart", () => {
    expect(cartStage({ status: "PENDING_PAYMENT", createdAt: ago(90), payments: [{ status: "DECLINED", updatedAt: ago(70) }, { status: "APPROVED", updatedAt: ago(75) }] })).toBeNull();
    expect(cartStage({ status: "CONFIRMED", createdAt: ago(90), payments: [] })).toBeNull();
    expect(cartStage({ status: "CANCELLED", createdAt: ago(90), payments: [] })).toBeNull();
  });
});

describe("truly abandoned carts", () => {
  it("only after an hour without news", () => {
    const left = cart({ createdAt: ago(61) });
    const filling = cart({ createdAt: ago(30) });
    const pse = cart({ status: "PENDING_PAYMENT", payments: [{ status: "PENDING", updatedAt: ago(20) }] });
    expect(run([left, filling, pse])).toEqual([left.personId]);
  });

  it("narrowed to where she stopped", () => {
    const form = cart();
    const payment = cart({ status: "PENDING_PAYMENT", payments: [{ status: "PENDING", updatedAt: ago(100) }] });
    const declined = cart({ status: "PENDING_PAYMENT", payments: [{ status: "ERROR", updatedAt: ago(100) }] });
    expect(run([form, payment, declined])).toEqual([form.personId, payment.personId, declined.personId]);
    expect(run([form, payment, declined], [], ["declined"])).toEqual([declined.personId]);
    expect(run([form, payment, declined], [], ["form", "payment"])).toEqual([form.personId, payment.personId]);
  });

  it("never someone who bought the same event under another of her records", () => {
    const domainTypo = cart({ email: "valeria.gomez@gmial.com" });
    const letterTypo = cart({ email: "valerya.gomez@gmail.com" });
    const samePhone = cart({ phone: "+57 300 123 4567" });
    const sameName = cart({ firstName: "María ", lastName: "Gómez  Ruiz" });
    const buyers = [
      buyer("valeria.gomez@gmail.com"),
      buyer("otra@correo.com", { phone: "3001234567" }),
      buyer("maria@correo.com", { firstName: "maria", lastName: "gomez ruiz" }),
    ];
    expect(run([domainTypo, letterTypo, samePhone, sameName], buyers)).toEqual([]);
  });

  it("keeps people who only look alike", () => {
    const digits = cart({ email: "laura01@gmail.com" });
    const otherDomain = cart({ email: "maria@hotmail.com" });
    const otherEvent = cart({ email: "sofia.perez@gmail.com" });
    const firstNameOnly = cart({ firstName: "Ana" });
    const buyers = [buyer("laura02@gmail.com"), buyer("maria@gmail.com"), buyer("sofia.perez@gmail.com", { eventId: "ev2" }), buyer("x@correo.com", { firstName: "Ana" })];
    expect(run([digits, otherDomain, otherEvent, firstNameOnly], buyers)).toEqual([digits.personId, otherDomain.personId, otherEvent.personId, firstNameOnly.personId]);
  });

  it("leaves out an email the account blocked", () => {
    const blocked = cart({ email: "Bloqueada@Correo.com" });
    const kept = cart();
    expect(run([blocked, kept], [], [], ["bloqueada@correo.com"])).toEqual([kept.personId]);
  });
});

describe("the segment condition", () => {
  it("is accepted from the composer for at least one event, any stage by default", () => {
    const parsed = filterSchema.safeParse({ include: [{ field: "abandonedCart", eventSlugs: ["imparables"] }], exclude: [] });
    expect(parsed.success && parsed.data.include[0]).toEqual({ field: "abandonedCart", eventSlugs: ["imparables"], stages: [] });
    expect(filterSchema.safeParse({ include: [{ field: "abandonedCart", eventSlugs: [] }], exclude: [] }).success).toBe(false);
    expect(filterSchema.safeParse({ include: [{ field: "abandonedCart", eventSlugs: ["imparables"], stages: ["otra"] }], exclude: [] }).success).toBe(false);
  });

  it("keeps only the stages it knows when read back", () => {
    const filter = normalizeFilter({ include: [{ field: "abandonedCart", eventSlugs: ["imparables"], stages: ["declined", "otra"] } as never], exclude: [] });
    expect(filter.include).toEqual([{ field: "abandonedCart", eventSlugs: ["imparables"], stages: ["declined"] }]);
  });
});
