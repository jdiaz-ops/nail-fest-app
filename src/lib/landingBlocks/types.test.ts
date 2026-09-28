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

describe("youtubeVideo", () => {
  it("reads the id from every common YouTube link", async () => {
    const { youtubeVideo } = await import("./types");
    expect(youtubeVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toEqual({ id: "dQw4w9WgXcQ", vertical: false });
    expect(youtubeVideo("https://youtu.be/dQw4w9WgXcQ?si=abc")).toEqual({ id: "dQw4w9WgXcQ", vertical: false });
    expect(youtubeVideo("https://m.youtube.com/shorts/abcDEF12345")).toEqual({ id: "abcDEF12345", vertical: true });
    expect(youtubeVideo("https://www.youtube.com/embed/dQw4w9WgXcQ")).toEqual({ id: "dQw4w9WgXcQ", vertical: false });
  });

  it("rejects anything that isn't a YouTube video", async () => {
    const { youtubeVideo } = await import("./types");
    expect(youtubeVideo("https://abc.public.blob.vercel-storage.com/event-videos/x.mp4")).toBeNull();
    expect(youtubeVideo("https://www.instagram.com/reel/xyz/")).toBeNull();
    expect(youtubeVideo("no es un enlace")).toBeNull();
  });
});
