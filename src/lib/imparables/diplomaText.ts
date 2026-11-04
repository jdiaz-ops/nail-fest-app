import type { Event } from "@prisma/client";
import { publicEventName } from "@/lib/eventDisplayName";
import { parseLandingBlocks } from "@/lib/landingBlocks/types";
import { castOf } from "./blocks";
import { stubDate } from "./boleta";
import { FRANJA } from "./esParaMi";
import { coverName, eventWhen } from "./schedule";

// What Manicuristas Imparables' diploma says (drawn by diploma.ts): her name, tidied, and the congress's words — kept
// apart from the drawing so her page can use them without loading the PDF's library.

export interface DiplomaData {
  /** «Ana María Rodríguez» */
  name: string;
  /** «Manicuristas», small over the last word. */
  pre: string;
  /** «Imparables» */
  big: string;
  /** «Manicuristas Imparables», in the sentence. */
  eventName: string;
  /** «congreso virtual de mentalidad, dinero y marketing para manicuristas» */
  kind: string;
  /** «domingo 4 de julio de 2027» */
  date: string;
  /** The speakers' names. */
  speakers: string[];
  /** Her ticket's code, «3F9K2L1Q». */
  code: string;
  /** The day in the seal, «04 · 07 · 2027». */
  stamp: string;
}

/** The sample buyer of the team's preview («Después del pago»), and her diploma's name and number. */
export const SAMPLE_NAME = { firstName: "Ana María", lastName: "Rodríguez" };
export const SAMPLE_DIPLOMA = { name: `${SAMPLE_NAME.firstName} ${SAMPLE_NAME.lastName}`, code: "MUESTRA" };

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase("es") + text.slice(1);

/** What a diploma of this event says, for her name and code. */
export function diplomaDataOf(event: Pick<Event, "name" | "publicName" | "startsAt" | "endsAt" | "scheduleDays" | "landingBlocks">, name: string, code: string, timezone: string): DiplomaData {
  const eventName = coverName(publicEventName(event as Event));
  const words = eventName.split(/\s+/);
  const big = words.pop() ?? "";
  const { speakers } = castOf(parseLandingBlocks(event.landingBlocks).filter((block) => !block.hidden));
  const when = eventWhen(event, timezone);
  return {
    name,
    pre: words.join(" "),
    big,
    eventName,
    kind: lowerFirst(FRANJA.replace(/\*\*/g, "")),
    date: lowerFirst(when.dates),
    speakers: speakers.map((speaker) => speaker.name.trim()).filter(Boolean),
    code,
    stamp: stubDate(when.days[when.days.length - 1]),
  };
}

// Words that stay small inside a name: «María de los Ángeles».
const SMALL = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "das", "do", "dos", "van", "von"]);

/** Her name for her diploma: as she wrote it — unless all of it was in small letters or all in capitals, then as a name: «ana maría de la cruz» → «Ana María de la Cruz». */
export function diplomaName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  const typed = [firstName, lastName]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
  const letters = typed.replace(/[^\p{L}]/gu, "");
  if (!letters || (letters !== letters.toLocaleLowerCase("es") && letters !== letters.toLocaleUpperCase("es"))) return typed;
  return typed
    .toLocaleLowerCase("es")
    .split(" ")
    .map((word, i) => (i > 0 && SMALL.has(word) ? word : word.replace(/(^|[-'’])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase("es"))))
    .join(" ");
}
