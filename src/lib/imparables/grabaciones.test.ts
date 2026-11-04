import { describe, expect, it } from "vitest";
import { emptyAgendaRow, type AgendaRow, type LandingBlock } from "@/lib/landingBlocks/types";
import { addDays, congressTimes, dayWords, readRecordings, talksOf, youtubeId } from "./grabaciones";

describe("youtubeId", () => {
  it("reads the video in every way YouTube gives its link", () => {
    for (const url of [
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=AbC123",
      "youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/live/dQw4w9WgXcQ?feature=share",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "  https://youtu.be/dQw4w9WgXcQ  ",
    ]) {
      expect(youtubeId(url), url).toBe("dQw4w9WgXcQ");
    }
  });

  it("refuses anything that isn't a video of YouTube", () => {
    for (const url of ["", "hola", "https://vimeo.com/123456789", "https://www.youtube.com/@nailfest", "https://youtu.be/corto", "https://www.youtube.com/watch?v=", "https://drive.google.com/file/d/abc/view"]) {
      expect(youtubeId(url), url).toBeNull();
    }
  });
});

describe("readRecordings", () => {
  it("keeps the list as saved, without empty rows, and nothing else", () => {
    expect(readRecordings(null)).toEqual({ until: null, items: [] });
    expect(readRecordings("x")).toEqual({ until: null, items: [] });
    expect(
      readRecordings({
        until: "2027-08-10",
        items: [{ title: " Cobra lo que vales ", speaker: "Jimena", url: "https://youtu.be/dQw4w9WgXcQ" }, { title: "", speaker: "", url: "" }, null, { title: "Panel" }],
      })
    ).toEqual({
      until: "2027-08-10",
      items: [
        { title: "Cobra lo que vales", speaker: "Jimena", url: "https://youtu.be/dQw4w9WgXcQ" },
        { title: "Panel", speaker: "", url: "" },
      ],
    });
    expect(readRecordings({ until: "10 de agosto", items: [] }).until).toBeNull();
  });
});

describe("talksOf", () => {
  const row = (fields: Partial<AgendaRow>): AgendaRow => ({ ...emptyAgendaRow("session"), ...fields });
  it("takes each talk someone gives from the program — not the breaks, lunch, the welcome or the closing", () => {
    const blocks: LandingBlock[] = [
      { type: "heading", eyebrow: "Agenda", title: "", intro: "" },
      {
        type: "agenda",
        rows: [
          { ...emptyAgendaRow("day"), chip: "Mañana" },
          row({ chip: "8:00 a. m.", topic: "Bienvenida", text: "Con Heidy" }),
          row({ chip: "8:15 a. m.", topic: "Cobra lo que vales", instructor: "Jimena Montalban" }),
          row({ chip: "9:20 a. m.", topic: "Panel «El día que decidí cambiar»", instructor: "Maris" }),
          row({ chip: "10:20 a. m.", topic: "Pausa activa", instructor: "@ssanchezacademy · Manicurista y fisioterapeuta" }),
          row({ chip: "12:40 p. m.", topic: "1 hora de almuerzo" }),
          row({ chip: "6:45 p. m.", topic: "Cierre y sorteo", instructor: "Heidy" }),
        ],
      },
    ];
    expect(talksOf(blocks)).toEqual([
      { title: "Cobra lo que vales", speaker: "Jimena Montalban", url: "" },
      { title: "Panel «El día que decidí cambiar»", speaker: "Maris", url: "" },
    ]);
  });
});

describe("the days", () => {
  it("counts days and says them", () => {
    expect(addDays("2027-07-04", 30)).toBe("2027-08-03");
    expect(addDays("2027-12-31", 1)).toBe("2028-01-01");
    expect(dayWords("2027-08-03")).toBe("martes 3 de agosto");
    expect(dayWords("2027-07-04")).toBe("domingo 4 de julio");
  });

  it("opens the recordings when the congress ends, for 30 days, or until the day the team picks", () => {
    const event = { startsAt: new Date("2027-07-04T13:00:00Z"), endsAt: new Date("2027-07-04T23:30:00Z"), scheduleDays: null };
    expect(congressTimes(event, { until: null, items: [] }, "America/Bogota")).toEqual({
      ends: new Date("2027-07-04T23:30:00Z"),
      lastDay: "2027-07-04",
      recordingsUntil: "2027-08-03",
      recordingsClose: new Date("2027-08-04T05:00:00Z"),
    });
    expect(congressTimes(event, { until: "2027-08-10", items: [] }, "America/Bogota").recordingsClose).toEqual(new Date("2027-08-11T05:00:00Z"));
  });
});
