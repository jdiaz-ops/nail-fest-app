import { describe, expect, it } from "vitest";
import { friendlyFrom } from "./provider";

describe("the From header's name", () => {
  it("is «Nail Fest» unless the email names its own, on the same address", () => {
    expect(friendlyFrom("tickets@nailfest.co")).toBe("Nail Fest <tickets@nailfest.co>");
    expect(friendlyFrom("Nail Fest <tickets@nailfest.co>")).toBe("Nail Fest <tickets@nailfest.co>");
    expect(friendlyFrom("tickets@nailfest.co", "Manicuristas Imparables")).toBe("Manicuristas Imparables <tickets@nailfest.co>");
    expect(friendlyFrom("Nail Fest <tickets@nailfest.co>", "Manicuristas Imparables")).toBe("Manicuristas Imparables <tickets@nailfest.co>");
    expect(friendlyFrom("tickets@nailfest.co", "  ")).toBe("Nail Fest <tickets@nailfest.co>");
  });

  it("never lets a name break out of the header, and quotes one with a comma or a dot", () => {
    const from = friendlyFrom("tickets@nailfest.co", 'Hola\r\nBcc: otra@ejemplo.co <x> "y"');
    expect(from).not.toMatch(/[\r\n]/);
    expect(from.match(/</g)).toHaveLength(1);
    expect(from.endsWith("<tickets@nailfest.co>")).toBe(true);
    expect(friendlyFrom("tickets@nailfest.co", "Nail Fest, Cúcuta")).toBe('"Nail Fest, Cúcuta" <tickets@nailfest.co>');
  });
});
