import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseLandingBlocks } from "./types";

describe("hidden landing blocks", () => {
  it("keeps the hidden flag, and leaves blocks saved without it visible", () => {
    const blocks = parseLandingBlocks([
      { type: "heading", title: "Regalos y sorteos", intro: "", hidden: true },
      { type: "heading", title: "Agenda", intro: "" },
      { type: "nonsense", hidden: true },
    ]);
    expect(blocks).toEqual([
      { type: "heading", title: "Regalos y sorteos", intro: "", hidden: true },
      { type: "heading", title: "Agenda", intro: "" },
    ]);
  });

  it("the admin API schema lets the flag through", () => {
    const schema = z
      .discriminatedUnion("type", [z.object({ type: z.literal("heading"), title: z.string(), intro: z.string() })])
      .and(z.object({ hidden: z.boolean().optional() }));
    expect(schema.parse({ type: "heading", title: "A", intro: "", hidden: true })).toEqual({ type: "heading", title: "A", intro: "", hidden: true });
  });
});
