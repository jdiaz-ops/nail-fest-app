import { describe, expect, it } from "vitest";
import { cleanTags, hasTopic, topicKey, topicsOf } from "./shared";
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
