// Parses a Ticket Tailor "doorlist" CSV export and normalizes it into one
// record per real person — pure functions, no DB access, so this runs
// identically in the browser (for a preview) and on the server (for the
// actual write). See /admin/import and docs/IMPORT.md.
//
// Doorlist quirk (confirmed against a real export): a person can hold up to
// 2 tickets under one order — themselves + a "+1" companion slot — but the
// companion's own data was never collected, so BOTH rows carry the
// registrant's own name/email/phone. Grouping by email is therefore not
// just dedup, it's correct: there is only ever one real person's data per
// email in this file, however many ticket rows it appears on.

export interface DoorlistRow {
  name: string;
  ticketType: string;
  ticketCode: string;
  orderId: string;
  checkedIn: string; // "Yes" | "No"
  email: string;
  phone: string;
  cedula: string;
  city: string;
  profession: string;
  instagram: string;
}

export interface ImportPerson {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  profession: string | null;
  cedula: string | null;
  instagram: string | null;
  checkedIn: boolean;
  ticketCount: number;
}

/** Minimal RFC4180 CSV parser — handles quoted fields, escaped `""`, commas
 * and newlines inside quotes. Ticket Tailor exports UTF-8 with a BOM. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const COLUMN_MAP: Record<string, keyof DoorlistRow> = {
  Name: "name",
  "Ticket type": "ticketType",
  "Ticket code": "ticketCode",
  "Order ID": "orderId",
  "Checked-in": "checkedIn",
  "Email address": "email",
  "Número de celular con WhatsApp - (asegúrate que sea correcto para recibir info del evento)": "phone",
  "Número de cédula - o - NIT": "cedula",
  "¿En que ciudad vives?": "city",
  "¿Cuál de estas opciones te describe mejor? (Selecciona una sola)": "profession",
  "Déjanos tu @ Instagram/Tiktok  (Opcional)": "instagram",
};

export function parseDoorlistCsv(text: string): DoorlistRow[] {
  const table = parseCsv(text);
  if (table.length === 0) return [];
  const header = table[0]!;
  const indexOf: Partial<Record<keyof DoorlistRow, number>> = {};
  header.forEach((col, i) => {
    const key = COLUMN_MAP[col.trim()];
    if (key) indexOf[key] = i;
  });

  const rows: DoorlistRow[] = [];
  for (let i = 1; i < table.length; i++) {
    const r = table[i]!;
    if (r.length <= 1 && (r[0] ?? "").trim() === "") continue; // trailing blank line
    const get = (key: keyof DoorlistRow) => (indexOf[key] !== undefined ? (r[indexOf[key]!] ?? "").trim() : "");
    rows.push({
      name: get("name"),
      ticketType: get("ticketType"),
      ticketCode: get("ticketCode"),
      orderId: get("orderId"),
      checkedIn: get("checkedIn"),
      email: get("email"),
      phone: get("phone"),
      cedula: get("cedula"),
      city: get("city"),
      profession: get("profession"),
      instagram: get("instagram"),
    });
  }
  return rows;
}

/** "+57 315 3804701" -> "+573153804701". Leaves unrecognizable input as-is
 * (digits only, no leading +) rather than guessing a country code. */
export function normalizePhoneForStorage(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return null;
  // Assumes the source already includes a country code (it does in every
  // Ticket Tailor export seen so far — the form's WhatsApp field forces a
  // country picker). E.164 storage form for consistency with live
  // registrations; hashPhone() strips non-digits again before hashing
  // regardless, so this only affects display/storage, not Meta matching.
  return "+" + digits;
}

/** Trims, collapses internal whitespace, title-cases. Doesn't try to merge
 * "Pereira" with "Pereira Risaralda" — those are left as distinct strings
 * rather than guessing a merge that could be wrong; review the city
 * breakdown after import if that matters for a given segment. */
export function normalizeCity(raw: string): string | null {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// Canonical profession labels (must match src/lib/seed.ts PROFESSIONS).
// Maps every raw variant observed in real exports onto one of these; an
// unrecognized value falls back to itself, trimmed, rather than being
// dropped — see the "unmapped professions" warning in the import result.
const PROFESSION_CANONICAL: Record<string, string> = {
  "💅 soy manicurista profesional": "💅 Soy manicurista profesional",
  "📚 soy estudiante de un programa técnico o carrera enfocada en manos y pies":
    "📚 Soy estudiante de un programa técnico o carrera enfocada en manos y pies",
  "📚 estudiante de un programa técnico o carrera enfocada en manos y pies":
    "📚 Soy estudiante de un programa técnico o carrera enfocada en manos y pies",
  "🎨 soy aficionada al nail art (me pinto las uñas en casa como hobby)":
    "🎨 Soy aficionada al nail art (me pinto las uñas en casa como hobby)",
  "🎨 aficionada al nail art (me pinto las uñas en casa como hobby)":
    "🎨 Soy aficionada al nail art (me pinto las uñas en casa como hobby)",
  "🎖️ soy propietaria o gerente de salón/spa de uñas": "🎖️ Soy propietaria o gerente de salón/spa de uñas",
  "🏫 soy propietaria o gerente de una academia de uñas": "🏫 Soy propietaria o gerente de una academia de uñas",
  "📦 soy distribuidor, mayorista o tienda multimarca especializada en productos para uñas":
    "📦 Soy distribuidor, mayorista o tienda multimarca especializada en productos para uñas",
  "🎤 soy educadora de uñas profesional": "🎤 Soy educadora de uñas profesional",
  "🤝 represento una marca de productos para uñas": "🤝 Represento una marca de productos para uñas",
  "❌ ninguna de las anteriores": "❌ Ninguna de las anteriores",
};

export function normalizeProfession(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return PROFESSION_CANONICAL[trimmed.toLowerCase()] ?? trimmed;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

export interface GroupResult {
  people: ImportPerson[];
  skippedNoEmail: number;
  unmappedProfessions: string[];
}

/** Groups doorlist rows (one per ticket) into one record per unique email —
 * the actual person. "Checked-in" becomes true if ANY of their tickets was
 * scanned (can't distinguish which ticket in the party was scanned, since
 * the companion slot has no identity of its own). */
export function groupIntoImportPeople(rows: DoorlistRow[]): GroupResult {
  const byEmail = new Map<string, ImportPerson>();
  let skippedNoEmail = 0;
  const unmapped = new Set<string>();

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      skippedNoEmail++;
      continue;
    }

    const profession = normalizeProfession(row.profession);
    if (profession && !Object.values(PROFESSION_CANONICAL).includes(profession) && row.profession.trim()) {
      unmapped.add(profession);
    }

    const existing = byEmail.get(email);
    const checkedInNow = row.checkedIn.trim().toLowerCase() === "yes";

    if (!existing) {
      const { firstName, lastName } = splitName(row.name);
      byEmail.set(email, {
        email,
        firstName,
        lastName,
        phone: normalizePhoneForStorage(row.phone),
        city: normalizeCity(row.city),
        profession,
        cedula: row.cedula.trim() || null,
        instagram: row.instagram.trim() || null,
        checkedIn: checkedInNow,
        ticketCount: 1,
      });
    } else {
      existing.ticketCount++;
      if (checkedInNow) existing.checkedIn = true;
      // Fill in anything missing from a later row of the same person
      // (rare, but a companion-slot row could in principle differ if the
      // form was edited between purchases) — never overwrite a value
      // already captured.
      existing.phone ??= normalizePhoneForStorage(row.phone);
      existing.city ??= normalizeCity(row.city);
      existing.profession ??= profession;
      existing.cedula ??= row.cedula.trim() || null;
      existing.instagram ??= row.instagram.trim() || null;
    }
  }

  return {
    people: [...byEmail.values()],
    skippedNoEmail,
    unmappedProfessions: [...unmapped],
  };
}
