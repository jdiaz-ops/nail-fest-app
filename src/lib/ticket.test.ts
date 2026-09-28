import { createHmac } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { confirmationCodeFor, issueQrToken, ticketHolderName, ticketsCheckedIn, ticketsFor, verifyQrToken } from "./ticket";

const SECRET = "test-secret";
const ID = "cmabc123xyz0000k7q2m9xa";

beforeAll(() => {
  process.env.APP_SECRET_KEY = SECRET;
});

describe("QR tokens", () => {
  it("ticket 1 keeps the exact format every already-sent ticket carries", () => {
    const legacy = `${ID}.${createHmac("sha256", SECRET).update(ID).digest("base64url")}`;
    expect(issueQrToken(ID)).toBe(legacy);
    expect(issueQrToken(ID, 1)).toBe(legacy);
    expect(verifyQrToken(legacy)).toEqual({ valid: true, registrationId: ID, ticketNumber: 1 });
  });

  it("each extra ticket has its own token that verifies back to its number", () => {
    const t2 = issueQrToken(ID, 2);
    const t3 = issueQrToken(ID, 3);
    expect(t2).not.toBe(issueQrToken(ID));
    expect(t2).not.toBe(t3);
    expect(verifyQrToken(t2)).toEqual({ valid: true, registrationId: ID, ticketNumber: 2 });
    expect(verifyQrToken(t3)).toEqual({ valid: true, registrationId: ID, ticketNumber: 3 });
    expect(verifyQrToken(issueQrToken(ID, 12)).ticketNumber).toBe(12);
  });

  it("rejects a ticket number grafted onto another ticket's signature", () => {
    const [, sig1] = issueQrToken(ID).split(".");
    expect(verifyQrToken(`${ID}_2.${sig1}`).valid).toBe(false);
  });

  it("never accepts an _1 or _0 form — one valid token per ticket", () => {
    for (const base of [`${ID}_1`, `${ID}_0`, `${ID}_01`]) {
      const sig = createHmac("sha256", SECRET).update(base).digest("base64url");
      expect(verifyQrToken(`${base}.${sig}`).valid).toBe(false);
    }
  });

  it("rejects garbage", () => {
    expect(verifyQrToken("").valid).toBe(false);
    expect(verifyQrToken("nodot").valid).toBe(false);
    expect(verifyQrToken(`${ID}.wrong`).valid).toBe(false);
  });
});

describe("confirmation codes and ticket list", () => {
  it("ticket 1 keeps the plain code, the rest get a suffix", () => {
    expect(confirmationCodeFor(ID)).toBe("K7Q2M9XA");
    expect(confirmationCodeFor(ID, 2)).toBe("K7Q2M9XA-2");
  });

  it("lists every ticket in order", () => {
    const tickets = ticketsFor(ID, 2);
    expect(tickets.map((t) => [t.ticketNumber, t.confirmationCode])).toEqual([
      [1, "K7Q2M9XA"],
      [2, "K7Q2M9XA-2"],
    ]);
    expect(tickets[0]!.qrToken).toBe(issueQrToken(ID));
    expect(ticketsFor(ID, 0)).toHaveLength(1);
  });

  it("names the companion after the titular", () => {
    expect(ticketHolderName("María Pérez", 1)).toBe("María Pérez");
    expect(ticketHolderName("María Pérez", 2)).toBe("Acompañante de María Pérez");
  });
});

describe("ticketsCheckedIn", () => {
  it("follows the scan log per ticket", () => {
    expect(ticketsCheckedIn(["a", "b"], new Set(["b"]), 1)).toEqual([false, true]);
  });

  it("fills from checkedInCount when a historical import is ahead of the log", () => {
    expect(ticketsCheckedIn(["a", "b"], new Set(), 1)).toEqual([true, false]);
    expect(ticketsCheckedIn(["a", "b"], new Set(), 2)).toEqual([true, true]);
    expect(ticketsCheckedIn(["a", "b", "c"], new Set(["c"]), 2)).toEqual([true, false, true]);
  });
});
