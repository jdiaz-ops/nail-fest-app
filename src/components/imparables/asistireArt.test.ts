import { describe, expect, it } from "vitest";
import { clampPlacement, FIRST_PLACEMENT, LAYOUTS, MAX_ZOOM, photoBox, photoRect } from "./asistireArt";

const box = photoBox("historia");
const square = { width: 2000, height: 2000 };

describe("her photo in the arch", () => {
  it("is the arch inside its gold edge, in both sizes", () => {
    expect(box).toEqual({ x: 246, y: 519, w: 588, h: 748, round: 294, foot: 20 });
    expect(photoBox("publicacion")).toMatchObject({ x: 326, y: 328, w: 428, h: 528 });
    expect([LAYOUTS.historia.width, LAYOUTS.historia.height, LAYOUTS.publicacion.height]).toEqual([1080, 1920, 1350]);
  });

  it("covers the arch at first, with the point chosen at its center", () => {
    const r = photoRect(box, square, { zoom: 1, u: 0.5, v: 0.5 });
    expect(r.h).toBe(748);
    expect(r.x + r.w / 2).toBe(box.x + box.w / 2);
    expect(r.y).toBe(box.y);
  });

  it("never leaves an edge of the photo inside the arch, nor zooms beyond the slider", () => {
    const p = clampPlacement(box, square, { zoom: 9, u: 0, v: 1 });
    expect(p.zoom).toBe(MAX_ZOOM);
    const r = photoRect(box, square, p);
    expect(r.x).toBeCloseTo(box.x);
    expect(r.y + r.h).toBeCloseTo(box.y + box.h);
    expect(clampPlacement(box, square, { zoom: 0.2, u: 0.5, v: 0.5 }).zoom).toBe(1);
  });

  it("moves a face a little above the middle into the arch's center, when the photo is tall enough", () => {
    const tall = { width: 1000, height: 2000 };
    expect(clampPlacement(box, tall, FIRST_PLACEMENT)).toEqual(FIRST_PLACEMENT);
  });
});

describe("the image's parts, top to bottom", () => {
  it("keeps the name, its pillars, the arch, the day, the signature and the brands in order and inside, in both sizes", () => {
    for (const format of ["historia", "publicacion"] as const) {
      const L = LAYOUTS[format];
      const s = L.sponsors;
      const tops = [
        L.tiara.y,
        L.pre.top,
        L.big.top,
        L.tagline.top,
        L.frame.y,
        L.date.top,
        L.kind.top,
        L.pill.top,
        L.signature.top,
        s.rule.top,
        s.label.top,
        s.logos.top,
      ];
      expect([...tops].sort((a, b) => a - b)).toEqual(tops);
      // Nothing runs into the next part.
      expect(L.big.top + L.big.height).toBeLessThanOrEqual(L.tagline.top);
      expect(L.tagline.top + L.tagline.height).toBeLessThanOrEqual(L.frame.y);
      expect(L.pill.top + L.pill.height).toBeLessThan(L.signature.top);
      expect(L.signature.top + L.signature.height).toBeLessThan(s.rule.top);
      expect(s.label.top + s.label.height).toBeLessThan(s.logos.top);
      // And a margin under the brands.
      expect(s.logos.top + s.logos.height).toBeLessThanOrEqual(L.height - 40);
    }
  });
});
