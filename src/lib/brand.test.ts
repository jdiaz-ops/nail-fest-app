import { describe, expect, it } from "vitest";
import { senderNameFor } from "./brand";

describe("who an event's emails come from", () => {
  it("is the name set in its «Correos del evento», or else its brand's", () => {
    expect(senderNameFor({ theme: "IMPARABLES" })).toBe("Manicuristas Imparables");
    expect(senderNameFor({ theme: "IMPARABLES", emailSenderName: "  " })).toBe("Manicuristas Imparables");
    // Nail Fest's events at a place stay as they were.
    expect(senderNameFor({ theme: "DEFAULT" })).toBe("Nail Fest");
    expect(senderNameFor(null)).toBe("Nail Fest");
    expect(senderNameFor({ theme: "IMPARABLES", emailSenderName: " Imparables 2027 " })).toBe("Imparables 2027");
  });
});
