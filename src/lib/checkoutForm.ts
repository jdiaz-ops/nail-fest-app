import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import type { CheckoutQuestion, CheckoutQuestionType, NameFormat } from "@prisma/client";
import { getOrderedProfessionOptions, syncProfessionOptions } from "@/lib/professions";

// See the CheckoutQuestion model's own comment in schema.prisma for why
// this exists as a real table instead of the static list it used to be:
// /admin/settings/checkout-form needs real add/edit/delete/reorder, and
// RegistrationForm.tsx + /api/register both need to read the same live
// definition so the form and its validation never drift apart.

const LOCKED_DEFAULTS: Omit<CheckoutQuestion, "id" | "createdAt" | "updatedAt">[] = [
  {
    key: "fullName",
    label: "Nombre y Apellido - o - Razón Social",
    type: "TEXT",
    required: true,
    options: [],
    order: 0,
    locked: true,
    nameFormat: "FULL",
    confirmEmail: false,
  },
  {
    key: "email",
    label: "Correo Electrónico (verifica que esté correcto; ahí enviaremos tu entrada)",
    type: "TEXT",
    required: true,
    options: [],
    order: 1,
    locked: true,
    nameFormat: "FULL",
    confirmEmail: false,
  },
  {
    key: "phone",
    label: "Número de celular con WhatsApp",
    type: "TEXT",
    required: true,
    options: [],
    order: 2,
    locked: true,
    nameFormat: "FULL",
    confirmEmail: false,
  },
  {
    key: "cedula",
    label: "Número de cédula - o - NIT",
    type: "TEXT",
    required: true,
    options: [],
    order: 3,
    locked: true,
    nameFormat: "FULL",
    confirmEmail: false,
  },
  {
    key: "city",
    label: "¿En qué ciudad vives?",
    type: "TEXT",
    required: true,
    options: [],
    order: 4,
    locked: true,
    nameFormat: "FULL",
    confirmEmail: false,
  },
  {
    key: "profession",
    label: "¿Cuál de estas opciones te describe mejor? (Selecciona una sola)",
    type: "RADIO",
    required: true,
    options: [],
    order: 5,
    locked: true,
    nameFormat: "FULL",
    confirmEmail: false,
  },
  {
    key: "instagram",
    label: "Déjanos tu @ Instagram/TikTok",
    type: "TEXT",
    required: false,
    options: [],
    order: 6,
    locked: false,
    nameFormat: "FULL",
    confirmEmail: false,
  },
];

export const LOCKED_KEYS = ["fullName", "email", "phone", "cedula", "city", "profession"] as const;
export type LockedKey = (typeof LOCKED_KEYS)[number];

// The three types that need a real options list — everything else ignores
// whatever `options` is passed and stores an empty array.
export const TYPES_WITH_OPTIONS = new Set<CheckoutQuestionType>(["SELECT", "RADIO", "CHECKBOX"]);

async function ensureSeeded(): Promise<void> {
  const count = await db.checkoutQuestion.count();
  if (count > 0) return;
  try {
    await db.checkoutQuestion.createMany({ data: LOCKED_DEFAULTS });
  } catch {
    // Another request seeded it first (unique constraint on `key`) — fine,
    // the table is seeded either way, that's all this function promises.
  }
}

export async function getCheckoutQuestions(): Promise<CheckoutQuestion[]> {
  await ensureSeeded();
  const questions = await db.checkoutQuestion.findMany({ orderBy: { order: "asc" } });
  // The "profession" row's real options live in ProfessionOption, not this
  // table (see syncProfessionOptions) — overlay the live list here so
  // every caller (the admin editor, most visibly) sees "the question's
  // options" as one coherent thing without needing to know that.
  const professionRow = questions.find((q) => q.key === "profession");
  if (professionRow) {
    professionRow.options = await getOrderedProfessionOptions();
  }
  return questions;
}

export async function createCustomQuestion(input: {
  label: string;
  type: CheckoutQuestionType;
  required: boolean;
  options: string[];
}): Promise<CheckoutQuestion> {
  await ensureSeeded();
  const maxOrder = await db.checkoutQuestion.aggregate({ _max: { order: true } });
  return db.checkoutQuestion.create({
    data: {
      key: `custom_${randomUUID().slice(0, 8)}`,
      label: input.label,
      type: input.type,
      required: input.required,
      options: TYPES_WITH_OPTIONS.has(input.type) ? input.options.filter(Boolean) : [],
      order: (maxOrder._max.order ?? -1) + 1,
      locked: false,
    },
  });
}

export async function updateQuestion(
  id: string,
  patch: {
    label?: string;
    required?: boolean;
    type?: CheckoutQuestionType;
    options?: string[];
    nameFormat?: NameFormat;
    confirmEmail?: boolean;
  }
): Promise<CheckoutQuestion> {
  const existing = await db.checkoutQuestion.findUniqueOrThrow({ where: { id } });
  // Locked rows: type is always structural and never editable here. Three
  // of them have one extra real, connected control beyond label/required —
  // everything else silently ignores anything else in the patch, simplest
  // for the caller.
  if (existing.locked) {
    const data: { label: string; required: boolean; nameFormat?: NameFormat; confirmEmail?: boolean } = {
      label: patch.label ?? existing.label,
      required: patch.required ?? existing.required,
    };
    // fullName: Full name (one field) vs. First & Last Name (two fields,
    // sent straight through instead of guessed via lib/name.ts) — see the
    // NameFormat enum's own comment.
    if (existing.key === "fullName" && patch.nameFormat) {
      data.nameFormat = patch.nameFormat;
    }
    // email: "ask twice to catch typos" — see the confirmEmail field's own
    // comment on CheckoutQuestion.
    if (existing.key === "email" && typeof patch.confirmEmail === "boolean") {
      data.confirmEmail = patch.confirmEmail;
    }
    // profession: the options textarea in the admin editor edits the real
    // ProfessionOption list, not a column on this row — see
    // syncProfessionOptions' own comment for why nothing is hard-deleted.
    if (existing.key === "profession" && patch.options) {
      const cleaned = patch.options.map((o) => o.trim()).filter(Boolean);
      if (cleaned.length < 2) throw new Error("needs_options");
      await syncProfessionOptions(cleaned);
    }
    return db.checkoutQuestion.update({ where: { id }, data });
  }
  const nextType = patch.type ?? existing.type;
  return db.checkoutQuestion.update({
    where: { id },
    data: {
      label: patch.label ?? existing.label,
      required: patch.required ?? existing.required,
      type: nextType,
      options: TYPES_WITH_OPTIONS.has(nextType) ? (patch.options ?? existing.options).filter(Boolean) : [],
    },
  });
}

export async function deleteQuestion(id: string): Promise<void> {
  const existing = await db.checkoutQuestion.findUniqueOrThrow({ where: { id } });
  if (existing.locked) throw new Error("cannot delete a locked question");
  await db.checkoutQuestion.delete({ where: { id } });
}

export async function moveQuestion(id: string, direction: "up" | "down"): Promise<void> {
  const existing = await db.checkoutQuestion.findUniqueOrThrow({ where: { id } });
  if (existing.locked) throw new Error("cannot move a locked question");
  const unlocked = await db.checkoutQuestion.findMany({ where: { locked: false }, orderBy: { order: "asc" } });
  const idx = unlocked.findIndex((q) => q.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= unlocked.length) return; // already at that edge — no-op, not an error
  const other = unlocked[swapIdx];
  if (!other) return;
  await db.$transaction([
    db.checkoutQuestion.update({ where: { id: existing.id }, data: { order: other.order } }),
    db.checkoutQuestion.update({ where: { id: other.id }, data: { order: existing.order } }),
  ]);
}
