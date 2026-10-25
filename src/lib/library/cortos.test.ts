import { describe, expect, it } from "vitest";
import { cleanTags, feedHref, feedRow, hasTopic, isVertical, startAt, topicKey, topicsOf, watchHref, type ShortItem } from "./shared";
import { videoInputSchema } from "./admin";
import { submissionSchema } from "./portal";
import { COMMUNITY_PRIVACY_TEXT, policyBlocks } from "@/lib/communityPrivacy";

describe("Cortos: topics", () => {
  it("a topic's address has no accents, case or spaces", () => {
    expect(topicKey("Nail art")).toBe("nail-art");
    expect(topicKey("  Acrílico ")).toBe("acrilico");
    expect(topicKey("Spa de manos")).toBe("spa-de-manos");
  });

  it("tags are stored tidy, without repeats, up to six", () => {
    expect(cleanTags([" Polygel ", "polygel", "POLYGEL", "Nail  art", ""])).toEqual(["Polygel", "Nail art"]);
    expect(cleanTags(["a", "b", "c", "d", "e", "f", "g"])).toHaveLength(6);
  });

  it("a video is in a topic by its theme or by a tag", () => {
    const video = { theme: "tecnicas", tags: ["Polygel", "Nail art"] };
    expect(hasTopic(video, "tecnicas")).toBe(true);
    expect(hasTopic(video, "polygel")).toBe(true);
    expect(hasTopic(video, "nail-art")).toBe(true);
    expect(hasTopic(video, "acrilico")).toBe(false);
  });

  it("the topics of some videos: the most first, a theme by its name, each video once", () => {
    const topics = topicsOf([
      { theme: "tecnicas", tags: ["Polygel"] },
      { theme: "tecnicas", tags: ["Polygel", "polygel"] },
      { theme: "bioseguridad", tags: ["Bioseguridad"] },
    ]);
    expect(topics).toEqual([
      { key: "polygel", label: "Polygel", count: 2 },
      { key: "tecnicas", label: "Técnicas", count: 2 },
      { key: "bioseguridad", label: "Salud y bioseguridad", count: 1 },
    ]);
  });

  it("the team's video form tidies the tags, and leaves them alone when it doesn't send them", () => {
    const base = { kind: "video", title: "Francesa", youtube: "dQw4w9WgXcQ", theme: "tecnicas", level: "principiante", products: [], steps: [], gated: false, visible: true };
    expect(videoInputSchema.parse({ ...base, tags: ["Polygel", "polygel", " Cromo "] }).tags).toEqual(["Polygel", "Cromo"]);
    expect(videoInputSchema.parse(base).tags).toEqual([]);
    expect(videoInputSchema.partial().parse({ visible: false }).tags).toBeUndefined();
  });

  it("an instructor picks up to three of the usual topics for a video she sends", () => {
    const parsed = submissionSchema.parse({
      youtube: "dQw4w9WgXcQ",
      title: "Francesa invertida",
      theme: "tecnicas",
      level: "intermedio",
      tags: ["Polygel", "Inventado", "Nail art", "Francesa", "Retiro"],
    });
    expect(parsed.tags).toEqual(["Polygel", "Nail art", "Francesa"]);
  });
});

describe("the privacy policy's community part", () => {
  it("reads as headings and paragraphs, with the contact address in place", () => {
    const blocks = policyBlocks(COMMUNITY_PRIVACY_TEXT, "hola@nailfest.lat");
    expect(blocks[0]).toEqual({ kind: "heading", text: "La comunidad Nail Fest" });
    const rights = blocks.find((b) => b.kind === "paragraph" && b.text.startsWith("Puedes conocer"));
    expect(rights?.text).toContain("escríbenos a hola@nailfest.lat");
    expect(policyBlocks("## Título\n\nTexto con {correo}.", null)).toEqual([
      { kind: "heading", text: "Título" },
      { kind: "paragraph", text: "Texto con los canales de contacto de esta política." },
    ]);
  });

  it("covers every part of the community", () => {
    for (const part of ["Registro gratis", "Cortos", "Cuenta de instructora", "Consultorio", "encuestas", "Galería", "Tus derechos"]) {
      expect(COMMUNITY_PRIVACY_TEXT).toContain(part);
    }
  });
});

describe("Explorar: every video in the scroll, with its filters", () => {
  const navidad = { key: "navidad", name: "Navidad", theme: "tendencias" };
  const videos = [
    { theme: "tecnicas", tags: ["Polygel", "Francesa"] },
    { theme: "tecnicas", tags: ["Polygel"] },
    { theme: "tecnicas", tags: ["Retiro"] },
    { theme: "negocio", tags: ["Precios", "Polygel"] },
    { theme: "tendencias", subcategories: [navidad], tags: ["Nail art"] },
    { theme: "tendencias", subcategories: [navidad], tags: ["Nail art"] },
    { theme: "errores", extraThemes: ["tecnicas"], tags: ["Polygel"] },
  ];
  const keys = (row: ReturnType<typeof feedRow>) => row.chips.map((c) => c.key);

  it("at the top: the themes in their order, then the topics of two videos or more and the subcategories", () => {
    const row = feedRow(videos, null);
    expect(row.theme).toBeNull();
    expect(keys(row)).toEqual(["tecnicas", "negocio", "errores", "tendencias", "polygel", "nail-art", "navidad"]);
  });

  it("inside a theme: its subcategories, then its tags from two videos; the theme is the row's", () => {
    const row = feedRow(videos, "tecnicas");
    expect(row.theme).toEqual({ key: "tecnicas", label: "Técnicas", count: 4 });
    expect(keys(row)).toEqual(["polygel"]);
    expect(keys(feedRow(videos, "tendencias"))).toEqual(["navidad", "nail-art"]);
  });

  it("a subcategory sits inside its own theme; a tag inside the theme most of its videos have", () => {
    expect(feedRow(videos, "navidad").theme?.key).toBe("tendencias");
    expect(feedRow(videos, "polygel").theme?.key).toBe("tecnicas");
    // A tag of one video still shows when it's the chosen one.
    const retiro = feedRow(videos, "retiro");
    expect(retiro.theme?.key).toBe("tecnicas");
    expect(keys(retiro)[0]).toBe("retiro");
  });

  it("a topic no video has: the top row", () => {
    expect(feedRow(videos, "no-existe")).toEqual(feedRow(videos, null));
  });

  it("a video's shape: what YouTube said, or until then three minutes or less and not a recording", () => {
    expect(isVertical({ vertical: false, kind: "video", durationSeconds: 40 })).toBe(false);
    expect(isVertical({ vertical: true, kind: "maraton", durationSeconds: 7200 })).toBe(true);
    expect(isVertical({ vertical: null, kind: "video", durationSeconds: 180 })).toBe(true);
    expect(isVertical({ vertical: null, kind: "video", durationSeconds: 181 })).toBe(false);
    expect(isVertical({ vertical: null, kind: "maraton", durationSeconds: 60 })).toBe(false);
    expect(isVertical({ vertical: null, kind: "video", durationSeconds: null })).toBe(true);
  });

  it("the scroll's address: the shared video first, empty filters left out", () => {
    expect(feedHref({})).toBe("/biblioteca/cortos");
    expect(feedHref({ q: "francesa polygel", tema: "tecnicas", v: "x", instructora: null, orden: "nuevo" })).toBe("/biblioteca/cortos?v=x&tema=tecnicas&q=francesa%20polygel&orden=nuevo");
  });

  it("a list's scroll from the tapped video on, then the ones before it", () => {
    const item = (slug: string) => ({ video: { slug } }) as ShortItem;
    const items = [item("a"), item("b"), item("c"), item("d")];
    expect(startAt(items, "c").map((i) => i.video.slug)).toEqual(["c", "d", "a", "b"]);
    expect(startAt(items, "a")).toBe(items);
    expect(startAt(items, "zz")).toBe(items);
  });

  it("a card opens the scroll with its list; its page while the scroll is off", () => {
    expect(watchHref("francesa", { tema: "tecnicas", orden: "nuevo" })).toBe("/biblioteca/cortos?v=francesa&tema=tecnicas&orden=nuevo");
    expect(watchHref("francesa", {})).toBe("/biblioteca/cortos?v=francesa");
    expect(watchHref("francesa", null)).toBe("/biblioteca/francesa");
  });
});
