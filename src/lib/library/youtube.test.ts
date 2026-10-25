import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanDescription, fetchChannel, fetchUploadsPage, fetchVideos, guessTheme, isoDurationSeconds, isShortVideo, parseChannel, YoutubeError } from "./youtube";

const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the channel to read", () => {
  it("from a handle or a link, the way people copy it", () => {
    expect(parseChannel("@hlacosedora")).toEqual({ handle: "hlacosedora" });
    expect(parseChannel("https://youtube.com/@hlacosedora?si=W1J17agr8IOtuqbQ")).toEqual({ handle: "hlacosedora" });
    expect(parseChannel("https://www.youtube.com/@HLaCosedora/videos")).toEqual({ handle: "hlacosedora" });
    expect(parseChannel("hlacosedora")).toEqual({ handle: "hlacosedora" });
    expect(parseChannel("https://www.youtube.com/channel/UC1234567890abcdefghijAB")).toEqual({ id: "UC1234567890abcdefghijAB" });
    expect(parseChannel("")).toBeNull();
    expect(parseChannel("https://instagram.com/hlacosedora")).toBeNull();
  });
});

describe("what each video suggests", () => {
  it("its length from YouTube's duration", () => {
    expect(isoDurationSeconds("PT58S")).toBe(58);
    expect(isoDurationSeconds("PT2M5S")).toBe(125);
    expect(isoDurationSeconds("PT1H2M3S")).toBe(3723);
    expect(isoDurationSeconds("P0D")).toBe(0);
    expect(isoDurationSeconds("nada")).toBeNull();
  });

  it("three minutes or less, or #shorts: a corto", () => {
    expect(isShortVideo(59, "Francesa en un minuto")).toBe(true);
    expect(isShortVideo(180, "Retiro sin dañar")).toBe(true);
    expect(isShortVideo(181, "Retiro sin dañar")).toBe(false);
    expect(isShortVideo(400, "Tip rápido #shorts")).toBe(true);
    expect(isShortVideo(null, "Sin duración")).toBe(false);
    expect(isShortVideo(0, "Un directo")).toBe(false);
  });

  it("its theme from the words of its title — an error or a trend says more than a technique", () => {
    expect(guessTheme("Cómo aplicar polygel paso a paso")).toBe("tecnicas");
    expect(guessTheme("5 errores con el polygel que levantan la uña")).toBe("errores");
    expect(guessTheme("¿Cuánto cobrar por unas uñas acrílicas?")).toBe("negocio");
    expect(guessTheme("Hongos en las uñas: qué hacer")).toBe("bioseguridad");
    expect(guessTheme("Review: el top coat que no se pone amarillo")).toBe("productos");
    expect(guessTheme("Antes y después: rescate de uñas mordidas")).toBe("transformaciones");
    expect(guessTheme("Tendencias de uñas para Navidad 2026")).toBe("tendencias");
    expect(guessTheme("Entrevista con una manicurista de Cúcuta")).toBe("personas");
    expect(guessTheme("Vlog de mi semana")).toBeNull();
    expect(guessTheme("Mi semana", "Hoy les enseño una francesa invertida")).toBe("tecnicas");
  });

  it("its description without links, hashtags or handles", () => {
    expect(cleanDescription("Hoy les enseño la francesa invertida.\n\nCompra aquí: https://tienda.com\n#uñas #nailart\n@hlacosedora\nGracias por ver.")).toBe(
      "Hoy les enseño la francesa invertida.\nGracias por ver.",
    );
    expect(cleanDescription("https://solo-un-enlace.com")).toBeNull();
    expect(cleanDescription("a".repeat(800))).toHaveLength(600);
  });
});

describe("reading the channel", () => {
  it("the channel by its handle, and its uploads", async () => {
    const fetchMock = vi.fn(() =>
      reply(200, { items: [{ id: "UCabc", snippet: { title: "H la Cosedora" }, contentDetails: { relatedPlaylists: { uploads: "UUabc" } }, statistics: { videoCount: "412" } }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchChannel("AIzaKEY", { handle: "hlacosedora" })).toEqual({ id: "UCabc", title: "H la Cosedora", uploadsId: "UUabc", videoCount: 412 });
    const url = new URL(String((fetchMock.mock.calls[0] as unknown as [URL])[0]));
    expect(url.pathname).toBe("/youtube/v3/channels");
    expect(url.searchParams.get("forHandle")).toBe("@hlacosedora");
    expect(url.searchParams.get("key")).toBe("AIzaKEY");
  });

  it("a page of uploads, then what each video is (upcoming lives left out)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => reply(200, { items: [{ contentDetails: { videoId: "v1" } }, { contentDetails: { videoId: "v2" } }], nextPageToken: "NEXT", pageInfo: { totalResults: 412 } })),
    );
    expect(await fetchUploadsPage("k", "UUabc", null)).toEqual({ ids: ["v1", "v2"], nextPageToken: "NEXT", total: 412 });

    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        reply(200, {
          items: [
            {
              id: "v1",
              snippet: { title: "Francesa con polygel", description: "Paso a paso", publishedAt: "2024-03-03T15:00:00Z", liveBroadcastContent: "none", tags: ["polygel", "uñas"] },
              contentDetails: { duration: "PT58S" },
              statistics: { viewCount: "12345" },
              status: { privacyStatus: "public" },
            },
            { id: "v2", snippet: { title: "En vivo el jueves", liveBroadcastContent: "upcoming" }, contentDetails: { duration: "P0D" } },
          ],
        }),
      ),
    );
    expect(await fetchVideos("k", ["v1", "v2"])).toEqual([
      {
        youtubeId: "v1",
        title: "Francesa con polygel",
        description: "Paso a paso",
        publishedAt: new Date("2024-03-03T15:00:00Z"),
        durationSeconds: 58,
        views: 12345,
        privacy: "public",
        tags: ["polygel", "uñas"],
      },
    ]);
  });

  it("what went wrong, in words: the key, the API off, the day's quota, no such channel", async () => {
    const fails = async (status: number, body: unknown) => {
      vi.stubGlobal("fetch", vi.fn(() => reply(status, body)));
      return fetchChannel("k", { handle: "x" }).catch((e: unknown) => (e instanceof YoutubeError ? e.problem : "otro"));
    };
    expect(await fails(400, { error: { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] } })).toBe("key");
    expect(await fails(403, { error: { errors: [{ reason: "accessNotConfigured" }] } })).toBe("api");
    expect(await fails(403, { error: { errors: [{ reason: "quotaExceeded" }] } })).toBe("quota");
    vi.stubGlobal("fetch", vi.fn(() => reply(200, { items: [] })));
    expect(await fetchChannel("k", { handle: "nadie" }).catch((e: YoutubeError) => e.problem)).toBe("channel");
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));
    expect(await fetchChannel("k", { handle: "x" }).catch((e: YoutubeError) => e.message)).toMatch(/No pudimos hablar con YouTube/);
  });
});
