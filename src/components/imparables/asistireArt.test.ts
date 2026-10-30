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
