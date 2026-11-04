import { describe, expect, it } from "vitest";
import { activeEventEmailDesign, eventEmailDesignName, eventEmailDesignOf } from "./eventEmailDesign";

describe("the design an event's emails go in", () => {
  it("Manicuristas Imparables has its own; a Nail Fest at a place, Nail Fest's; a virtual Nail Fest, none", () => {
    expect(eventEmailDesignOf({ theme: "IMPARABLES", format: "VIRTUAL" })).toBe("IMPARABLES");
    expect(eventEmailDesignOf({ theme: "NAIL_FEST", format: "IN_PERSON" })).toBe("NAIL_FEST");
    expect(eventEmailDesignOf({ theme: "NAIL_FEST", format: "VIRTUAL" })).toBeNull();
  });

  it("goes in it only when it's on, and only in its own", () => {
    expect(activeEventEmailDesign({ theme: "IMPARABLES", format: "VIRTUAL", broadcastDesign: "IMPARABLES" })).toBe("IMPARABLES");
    expect(activeEventEmailDesign({ theme: "IMPARABLES", format: "VIRTUAL", broadcastDesign: null })).toBeNull();
    expect(activeEventEmailDesign({ theme: "IMPARABLES", format: "VIRTUAL", broadcastDesign: "NAIL_FEST" })).toBeNull();
    expect(activeEventEmailDesign({ theme: "NAIL_FEST", format: "IN_PERSON", broadcastDesign: "NAIL_FEST" })).toBe("NAIL_FEST");
  });

  it("says its name on the switch", () => {
    expect(eventEmailDesignName("IMPARABLES")).toBe("Imparables");
    expect(eventEmailDesignName("NAIL_FEST")).toBe("Nail Fest");
  });
});
