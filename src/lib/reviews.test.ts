import { describe, expect, it } from "vitest";
import { aggregateFromCounts, isOwnReviewPhotoUrl, normalizeInstagramHandle, publicReviewerName, seededShuffle, winnerMessage } from "./reviews";

describe("reviews helpers", () => {
  it("normalizes Instagram handles", () => {
    expect(normalizeInstagramHandle("@Karen.NailArt ")).toBe("karen.nailart");
    expect(normalizeInstagramHandle("https://www.instagram.com/karen_nails/")).toBe("karen_nails");
    expect(normalizeInstagramHandle("karen nails")).toBeNull();
    expect(normalizeInstagramHandle("")).toBeNull();
  });
  it("accepts only this registration's own Blob photos", () => {
    expect(isOwnReviewPhotoUrl("https://abc123.public.blob.vercel-storage.com/reviews/reg1/photo-x1.jpg", "reg1")).toBe(true);
    expect(isOwnReviewPhotoUrl("https://abc123.public.blob.vercel-storage.com/reviews/reg2/photo-x1.jpg", "reg1")).toBe(false);
    expect(isOwnReviewPhotoUrl("https://evil.example.com/reviews/reg1/photo.jpg", "reg1")).toBe(false);
    expect(isOwnReviewPhotoUrl("not a url", "reg1")).toBe(false);
  });
  it("shows first name and surname initial in public", () => {
    expect(publicReviewerName({ firstName: "Karen", lastName: "Mantilla" })).toBe("Karen M.");
    expect(publicReviewerName({ firstName: "Karen", lastName: null })).toBe("Karen");
    expect(publicReviewerName({ firstName: null, lastName: null })).toBe("Asistente");
  });
  it("aggregates ratings with one decimal", () => {
    const a = aggregateFromCounts([{ rating: 5, count: 8 }, { rating: 4, count: 1 }, { rating: 1, count: 1 }]);
    expect(a.count).toBe(10);
    expect(a.average).toBe(4.5);
    expect(a.distribution[5]).toBe(8);
    expect(aggregateFromCounts([]).average).toBeNull();
  });
  it("the raffle shuffle is reproducible from its seed", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const once = seededShuffle(ids, "deadbeef");
    expect(seededShuffle(ids, "deadbeef")).toEqual(once);
    expect(seededShuffle(ids, "feedface")).not.toEqual(once);
    expect([...once].sort()).toEqual(ids);
  });
  it("prepares the winner message", () => {
    expect(winnerMessage("Karen", "Nail Fest Cúcuta 2026", "kit de marcas")).toMatch(/^¡Hola, Karen! Gracias por tu reseña de Nail Fest Cúcuta 2026/);
    expect(winnerMessage(null, "X", "kit")).toMatch(/^¡Hola! /);
  });
});
