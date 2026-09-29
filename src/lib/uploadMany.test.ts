import { describe, expect, it } from "vitest";
import { uploadMany } from "./uploadMany";

const file = (name: string) => new File(["x"], name);

describe("uploadMany", () => {
  it("keeps the picked order even when uploads finish out of order, and lists failures", async () => {
    const delays: Record<string, number> = { "a.jpg": 30, "b.jpg": 5, "c.jpg": 15, "d.jpg": 1 };
    const progress: number[] = [];
    const { values, failed } = await uploadMany(
      ["a.jpg", "b.jpg", "c.jpg", "d.jpg"].map(file),
      async (f) => {
        await new Promise((r) => setTimeout(r, delays[f.name]));
        return f.name === "c.jpg" ? { ok: false as const, error: "La imagen pesa más de 5MB." } : { ok: true as const, value: `url/${f.name}` };
      },
      (done) => progress.push(done)
    );
    expect(values).toEqual(["url/a.jpg", "url/b.jpg", "url/d.jpg"]);
    expect(failed).toEqual(["c.jpg: La imagen pesa más de 5MB."]);
    expect(progress).toEqual([1, 2, 3, 4]);
  });
});
