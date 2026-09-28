import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// A tiny in-memory stand-in for the two tables recordScan touches — enough
// to exercise the real per-ticket first-entry / re-entry logic end to end.
interface Log {
  registrationId?: string;
  token: string;
  result: string;
  scannedAt: Date;
  clientScanId?: string;
}
const store = vi.hoisted(() => ({
  logs: [] as Log[],
  registrations: new Map<string, { id: string; eventId: string; ticketCount: number; checkedInCount: number }>(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    scanLog: {
      findUnique: async ({ where }: { where: { clientScanId: string } }) =>
        store.logs.find((l) => l.clientScanId === where.clientScanId) ?? null,
      findFirst: async ({ where }: { where: { registrationId: string; token: string; result: { in: string[] } } }) =>
        store.logs
          .filter((l) => l.registrationId === where.registrationId && l.token === where.token && where.result.in.includes(l.result))
          .sort((a, b) => b.scannedAt.getTime() - a.scannedAt.getTime())[0] ?? null,
      create: async ({ data }: { data: Omit<Log, "scannedAt"> & { scannedAt?: Date } }) => {
        const row = { ...data, scannedAt: data.scannedAt ?? new Date() };
        store.logs.push(row);
        return row;
      },
    },
    registration: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const r = store.registrations.get(where.id);
        return r ? { ...r, person: { firstName: "María", lastName: "Pérez", email: "m@x.co" }, event: { name: "Nail Fest Cúcuta" } } : null;
      },
      update: async ({ where }: { where: { id: string } }) => {
        const r = store.registrations.get(where.id)!;
        r.checkedInCount += 1;
        return r;
      },
    },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

import { recordScan } from "./scan";
import { issueQrToken } from "./ticket";

const REG = "cmreg0000000000k7q2m9xa";
const EVENT = "ev1";
const minutesLater = (m: number) => new Date(Date.now() + m * 60_000);

beforeAll(() => {
  process.env.APP_SECRET_KEY = "test-secret";
});

beforeEach(() => {
  store.logs = [];
  store.registrations = new Map([[REG, { id: REG, eventId: EVENT, ticketCount: 2, checkedInCount: 0 }]]);
});

describe("recordScan with a 2-ticket order", () => {
  it("counts the titular and the companion as two separate first entries", async () => {
    const first = await recordScan(issueQrToken(REG), EVENT);
    const second = await recordScan(issueQrToken(REG, 2), EVENT, undefined, { scannedAt: minutesLater(1) });
    expect(first).toMatchObject({ result: "VALID_FIRST", personName: "María Pérez" });
    expect(second).toMatchObject({ result: "VALID_FIRST", personName: "Acompañante de María Pérez" });
    expect(store.registrations.get(REG)!.checkedInCount).toBe(2);
  });

  it("a ticket scanned again later is a re-entry of that ticket only", async () => {
    await recordScan(issueQrToken(REG, 2), EVENT);
    const again = await recordScan(issueQrToken(REG, 2), EVENT, undefined, { scannedAt: minutesLater(30) });
    const titular = await recordScan(issueQrToken(REG), EVENT, undefined, { scannedAt: minutesLater(31) });
    expect(again.result).toBe("VALID_REENTRY");
    expect(titular.result).toBe("VALID_FIRST");
    expect(store.registrations.get(REG)!.checkedInCount).toBe(2);
  });

  it("the titular's QR used twice does not count the companion", async () => {
    await recordScan(issueQrToken(REG), EVENT);
    const again = await recordScan(issueQrToken(REG), EVENT, undefined, { scannedAt: minutesLater(5) });
    expect(again.result).toBe("VALID_REENTRY");
    expect(store.registrations.get(REG)!.checkedInCount).toBe(1);
  });

  it("rejects a ticket number past the order's count", async () => {
    const third = await recordScan(issueQrToken(REG, 3), EVENT);
    expect(third.result).toBe("NOT_FOUND");
    expect(store.registrations.get(REG)!.checkedInCount).toBe(0);
  });

  it("still flags a companion ticket from another event", async () => {
    const wrong = await recordScan(issueQrToken(REG, 2), "other-event");
    expect(wrong).toMatchObject({ result: "WRONG_EVENT", personName: "Acompañante de María Pérez" });
  });
});
