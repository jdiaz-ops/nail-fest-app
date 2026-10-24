import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatLength,
  formatViews,
  handleOf,
  parseDuration,
  toneOf,
  usedProductRefsOf,
  withExamples,
  youtubeIdFrom,
} from "./shared";
import { rankBy, scoreFields } from "./search";
import { isLibraryAccessToken, libraryAccessToken } from "./access";
import { leadSchema } from "./leads";
import { resolveSections, resolveTexts, LIBRARY_TEXTS } from "./texts";
import { classInputSchema, toBogotaInput, videoInputSchema } from "./admin";
import { sampleInstructors, sampleVideoDetail, sampleVideos } from "./samples";

describe("YouTube links", () => {
  it("takes the id from every kind of link the admin may paste", () => {
    expect(youtubeIdFrom("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("https://youtube.com/shorts/dQw4w9WgXcQ?feature=share")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom(" dQw4w9WgXcQ ")).toBe("dQw4w9WgXcQ");
  });

  it("refuses anything that isn't a YouTube video", () => {
    expect(youtubeIdFrom("https://vimeo.com/123456")).toBeNull();
    expect(youtubeIdFrom("https://www.youtube.com/@nailfest")).toBeNull();
    expect(youtubeIdFrom("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeIdFrom("hola")).toBeNull();
  });
});

describe("durations and views", () => {
  it("reads 0:48, 1:02:30 and plain seconds", () => {
    expect(parseDuration("0:48")).toBe(48);
    expect(parseDuration("1:02:30")).toBe(3750);
    expect(parseDuration("95")).toBe(95);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("1:75")).toBeNull();
    expect(parseDuration("cinco")).toBeNull();
  });

  it("writes them back the way people read them", () => {
    expect(formatDuration(48)).toBe("0:48");
    expect(formatDuration(3750)).toBe("1:02:30");
    expect(formatLength(3 * 3600)).toBe("3 horas");
    expect(formatLength(5400)).toBe("1 h 30 min");
    expect(formatLength(2700)).toBe("45 min");
  });

  it("rounds views down, Colombian style", () => {
    expect(formatViews(1)).toBe("1 vista");
    expect(formatViews(350)).toBe("350 vistas");
    expect(formatViews(1250)).toBe("1,2 mil vistas");
    expect(formatViews(21400)).toBe("21,4 mil vistas");
    expect(formatViews(1_560_000)).toBe("1,5 M de vistas");
  });
});

describe("people", () => {
  it("keeps only the username of an Instagram or TikTok link", () => {
    expect(handleOf("@ana.unas")).toBe("ana.unas");
    expect(handleOf("https://www.instagram.com/ana.unas/?hl=es")).toBe("ana.unas");
    expect(handleOf("tiktok.com/@ana_unas")).toBe("ana_unas");
    expect(handleOf("no vale con espacios")).toBeNull();
    expect(handleOf("")).toBeNull();
  });

  it("gives the same face the same gradient", () => {
    expect(toneOf("ana")).toBe(toneOf("ana"));
    expect(toneOf("ana")).toBeGreaterThanOrEqual(1);
    expect(toneOf("ana")).toBeLessThanOrEqual(8);
  });
});

describe("Lo que usó", () => {
  it("keeps only well-formed products", () => {
    expect(
      usedProductRefsOf([{ cuponeraProductId: "p1", brand: "Marca", name: " Polygel " }, { brand: "Sin nombre" }, "basura", { name: "Lima", brand: 3 }]),
    ).toEqual([
      { cuponeraProductId: "p1", brand: "Marca", name: "Polygel" },
      { cuponeraProductId: null, brand: "", name: "Lima" },
    ]);
    expect(usedProductRefsOf(null)).toEqual([]);
  });
});

describe("examples", () => {
  it("fill up for staff and never show to the public", () => {
    expect(withExamples([1, 2], [10, 11, 12], 4, true)).toEqual([1, 2, 10, 11]);
    expect(withExamples([1, 2, 3, 4, 5], [10], 4, true)).toEqual([1, 2, 3, 4, 5]);
    expect(withExamples([1, 2], [10, 11], 4, false)).toEqual([1, 2]);
  });

  it("are invented people and brands, with no video and no store", () => {
    const videos = sampleVideos(new Date("2026-10-24T12:00:00Z"));
    expect(videos.length).toBeGreaterThan(10);
    expect(videos.every((v) => v.sample && v.youtubeId === null && v.slug.startsWith("ejemplo-"))).toBe(true);
    expect(videos.filter((v) => v.kind === "maraton").every((v) => v.gated)).toBe(true);
    const detail = sampleVideoDetail(videos[0]!.slug)!;
    expect(detail.products.every((p) => p.url === null && p.code === "NAILFEST")).toBe(true);
    expect(sampleInstructors().every((i) => i.sample && i.name.startsWith("Instructora "))).toBe(true);
  });
});

describe("search", () => {
  const items = [
    { title: "3 errores que levantan el polygel", body: "preparación" },
    { title: "Extensión con molde", body: "polygel paso a paso" },
    { title: "Precio de un servicio", body: "negocio" },
  ];
  const fields = (i: (typeof items)[number]) => [
    { text: i.title, weight: 5 },
    { text: i.body, weight: 1 },
  ];

  it("needs every word, accents and capitals aside", () => {
    expect(scoreFields(fields(items[0]!), ["polygel", "errores"])).toBeGreaterThan(0);
    expect(scoreFields(fields(items[0]!), ["polygel", "precio"])).toBe(0);
    expect(rankBy(items, ["extension"], fields)).toEqual([items[1]]);
  });

  it("puts a word in the title before the same word in the text", () => {
    expect(rankBy(items, ["polygel"], fields)).toEqual([items[0], items[1]]);
  });
});

describe("the sign-up cookie", () => {
  it("opens only with Nail Fest's signature", () => {
    process.env.APP_SECRET_KEY = "test-secret";
    const token = libraryAccessToken("lead123");
    expect(isLibraryAccessToken(token)).toBe(true);
    expect(isLibraryAccessToken("lead123.firma-falsa")).toBe(false);
    expect(isLibraryAccessToken(token.replace("lead123", "lead124"))).toBe(false);
    expect(isLibraryAccessToken(undefined)).toBe(false);
  });
});

describe("the forms", () => {
  const base = { name: "Ana Pérez", email: " ANA@correo.com ", marketingConsent: true };

  it("asks each form for what it needs", () => {
    expect(leadSchema.safeParse({ ...base, kind: "REGISTRO" }).success).toBe(true);
    expect(leadSchema.safeParse({ ...base, kind: "CLASE" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, kind: "MARCA", phone: "3001234567" }).success).toBe(false);
    expect(leadSchema.safeParse({ ...base, kind: "MARCA", phone: "3001234567", company: "Marca" }).success).toBe(true);
    expect(leadSchema.safeParse({ ...base, kind: "POSTULACION", phone: "3001234567" }).success).toBe(false);
    const parsed = leadSchema.parse({ ...base, kind: "REGISTRO", city: "  " });
    expect(parsed.email).toBe("ana@correo.com");
    expect(parsed.city).toBeNull();
  });
});

describe("texts and sections", () => {
  it("use the usual text when the admin leaves it empty", () => {
    const texts = resolveTexts({ homeTitle: "  Mi biblioteca ", usedTitle: "   ", nope: "x" });
    expect(texts.homeTitle).toBe("Mi biblioteca");
    expect(texts.usedTitle).toBe(LIBRARY_TEXTS.usedTitle.value);
    expect(resolveSections({ steps: false, used: "no" })).toMatchObject({ steps: false, used: true, themes: true });
  });
});

describe("the admin's forms", () => {
  const video = {
    kind: "video",
    title: "Francesa invertida",
    youtube: "https://youtube.com/shorts/dQw4w9WgXcQ",
    duration: "0:48",
    theme: "tecnicas",
    level: "intermedio",
    products: [{ cuponeraProductId: "p1", brand: "Marca", name: "Gel" }],
    steps: ["Uno"],
    gated: false,
    visible: true,
  };

  it("turns a YouTube link and a duration into what's stored", () => {
    const parsed = videoInputSchema.parse(video);
    expect(parsed.youtube).toBe("dQw4w9WgXcQ");
    expect(parsed.duration).toBe(48);
    expect(parsed.products).toEqual([{ cuponeraProductId: "p1", brand: "Marca", name: "Gel" }]);
    expect(videoInputSchema.safeParse({ ...video, youtube: "https://vimeo.com/1" }).success).toBe(false);
    expect(videoInputSchema.safeParse({ ...video, duration: "mucho" }).success).toBe(false);
    expect(videoInputSchema.safeParse({ ...video, theme: "otro" }).success).toBe(false);
  });

  it("reads a class's date in Bogotá time, both ways", () => {
    const parsed = classInputSchema.parse({ instructorId: "i1", title: "Maratón", startsAt: "2026-11-12T19:00", place: "Zoom", visible: true });
    expect(parsed.startsAt.toISOString()).toBe("2026-11-13T00:00:00.000Z");
    expect(toBogotaInput(parsed.startsAt)).toBe("2026-11-12T19:00");
    expect(classInputSchema.safeParse({ instructorId: "i1", title: "Maratón", startsAt: "2026-11-12T19:00", place: "Zoom", url: "http://x.co", visible: true }).success).toBe(false);
  });
});
