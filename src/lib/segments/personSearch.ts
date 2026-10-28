import type { Prisma } from "@prisma/client";

// What SegmentComposer's "Personas específicas" search box matches on —
// a phone in any spelling ("313 241", "+57 313 241…", "3132410001" all
// reduce to the same digits, and Person.phone is stored E.164, so a digit
// run is a plain substring of it), an email, or a name. Same rules as
// /admin/crm/personas' own search box, minus city and cédula: here the
// point is to pick out ONE specific person, and "Bogotá" matching
// thousands of people would only bury them. Type-only Prisma import, so
// the composer (a client component) can share PERSON_SEARCH_MIN_LENGTH
// and matchRange below without bundling Prisma.
export const PERSON_SEARCH_MIN_LENGTH = 3;
const MIN_PHONE_DIGITS = 4;

export function personSearchWhere(rawQuery: string): Prisma.PersonWhereInput | null {
  const q = rawQuery.trim();
  if (q.length < PERSON_SEARCH_MIN_LENGTH) return null;
  const digits = q.replace(/\D/g, "");
  const [firstWord = "", ...restWords] = q.split(/\s+/);
  const or: Prisma.PersonWhereInput[] = [
    { email: { contains: q, mode: "insensitive" } },
    { firstName: { contains: q, mode: "insensitive" } },
    { lastName: { contains: q, mode: "insensitive" } },
  ];
  if (digits.length >= MIN_PHONE_DIGITS) or.push({ phone: { contains: digits } });
  // "Laura Gómez" typed together, across the two name columns.
  if (restWords.length > 0) {
    or.push({
      AND: [
        { firstName: { contains: firstWord, mode: "insensitive" } },
        { lastName: { contains: restWords.join(" "), mode: "insensitive" } },
      ],
    });
  }
  return { OR: or };
}

/** Where `query` shows up inside `text`, for highlighting it in a search
 * result — [start, end) or null. Tries the query as typed (case-
 * insensitive) first, then as bare digits, so "313 241" still lights up
 * inside a phone displayed as "+57 313 241 0001" or "+573132410001",
 * whichever grouping that display uses. */
export function matchRange(text: string, query: string): [number, number] | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const direct = text.toLowerCase().indexOf(q);
  if (direct >= 0) return [direct, direct + q.length];

  const digits = q.replace(/\D/g, "");
  if (digits.length < MIN_PHONE_DIGITS) return null;
  const positions: number[] = [];
  let textDigits = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (ch >= "0" && ch <= "9") {
      positions.push(i);
      textDigits += ch;
    }
  }
  const at = textDigits.indexOf(digits);
  const start = positions[at];
  const last = positions[at + digits.length - 1];
  if (at < 0 || start === undefined || last === undefined) return null;
  return [start, last + 1];
}
