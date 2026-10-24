import { describe, expect, it } from "vitest";
import { STAFF_REACTIONS, canBeReactedTo, inboundReactionBody, reactionBlockedReason } from "./reactions";

const now = new Date("2026-10-25T17:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("reacting from Bandeja", () => {
  it("offers exactly the team's two emojis", () => {
    expect([...STAFF_REACTIONS]).toEqual(["❤️", "💅"]);
  });

  it("works on what the person sent, never on our messages or on their reactions", () => {
    expect(canBeReactedTo({ direction: "INBOUND", providerMessageId: "wamid.1", body: "Acrilicas y jelly tips" })).toBe(true);
    expect(canBeReactedTo({ direction: "INBOUND", providerMessageId: "wamid.2", body: null })).toBe(true);
    expect(canBeReactedTo({ direction: "OUTBOUND", providerMessageId: "wamid.3", body: "Hola" })).toBe(false);
    expect(canBeReactedTo({ direction: "INBOUND", providerMessageId: null, body: "Hola" })).toBe(false);
    expect(canBeReactedTo({ direction: "INBOUND", providerMessageId: "wamid.4", body: inboundReactionBody("👍") })).toBe(false);
    expect(canBeReactedTo({ direction: "INBOUND", providerMessageId: "wamid.5", body: inboundReactionBody(undefined) })).toBe(false);
  });

  it("only within 24h of their last message and for messages up to 30 days old", () => {
    expect(reactionBlockedReason(hoursAgo(2), hoursAgo(2), now)).toBeNull();
    expect(reactionBlockedReason(hoursAgo(30), hoursAgo(1), now)).toBeNull();
    expect(reactionBlockedReason(hoursAgo(25), hoursAgo(25), now)).toMatch(/24 horas/);
    expect(reactionBlockedReason(hoursAgo(2), null, now)).toMatch(/24 horas/);
    expect(reactionBlockedReason(hoursAgo(31 * 24), hoursAgo(1), now)).toMatch(/30 días/);
  });
});
