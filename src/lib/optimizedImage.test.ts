import { describe, expect, it } from "vitest";
import { optimizedSrc, optimizedSrcSet } from "./optimizedImage";

const blob = "https://abc123.public.blob.vercel-storage.com/event-images/x.jpg";

describe("optimizedSrc", () => {
  it("routes Blob photos through the optimizer at an allowed width", () => {
    expect(optimizedSrc(blob, 170)).toBe(`/_next/image?url=${encodeURIComponent(blob)}&w=256&q=75`);
    expect(optimizedSrc(blob, 5000)).toContain("&w=1920&");
  });

  it("leaves anything else alone", () => {
    expect(optimizedSrc("/logo.png", 200)).toBe("/logo.png");
    expect(optimizedSrc("https://i.ytimg.com/vi/x/hqdefault.jpg", 200)).toBe("https://i.ytimg.com/vi/x/hqdefault.jpg");
    expect(optimizedSrcSet("/logo.png", [256])).toBeUndefined();
  });

  it("builds a srcSet with the real served widths", () => {
    expect(optimizedSrcSet(blob, [256, 384])).toBe(`${optimizedSrc(blob, 256)} 256w, ${optimizedSrc(blob, 384)} 384w`);
  });
});
