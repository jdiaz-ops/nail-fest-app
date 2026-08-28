import { db } from "@/lib/db";
import { PROFESSIONS } from "@/lib/seed";

const RANK = new Map(PROFESSIONS.map((label, i) => [label, i]));

/**
 * Active profession options in their saved `order` (manicurista first,
 * "ninguna de las anteriores" last, by default) — `order` is what makes
 * syncProfessionOptions' admin editing actually stick, see its own
 * comment. RANK only matters once, as the initial order for the seeded
 * PROFESSIONS list (see lib/seed.ts) — after that, `order` is the single
 * source of truth.
 */
export async function getOrderedProfessionOptions(): Promise<string[]> {
  const rows = await db.professionOption.findMany({ where: { active: true }, orderBy: { order: "asc" } });
  return rows.map((r) => r.label);
}

/**
 * Makes the "Profesión" question's options genuinely admin-editable from
 * /admin/settings/checkout-form — see CheckoutFormEditor.tsx and
 * lib/checkoutForm.ts's updateQuestion. `labels` is the admin's textarea,
 * one answer per line, in the order they want them shown.
 *
 * Never hard-deletes a row: Person.profession is a free string, not a
 * foreign key (see the Person model's own comment), so an old label an
 * admin just removed from the form may still sit on historical Person
 * rows and inside past segments/broadcasts — deleting the row would only
 * orphan the label's meaning, not the data. Marking it `active: false`
 * removes it from the form and getOrderedProfessionOptions() without
 * losing that history; re-adding the same label later reactivates the
 * same row instead of creating a duplicate (label is @unique).
 */
export async function syncProfessionOptions(labels: string[]): Promise<void> {
  const cleaned = labels.map((l) => l.trim()).filter(Boolean);
  const wanted = new Set(cleaned);

  await db.$transaction([
    ...cleaned.map((label, order) =>
      db.professionOption.upsert({
        where: { label },
        update: { active: true, order },
        create: { label, active: true, order },
      })
    ),
    db.professionOption.updateMany({
      where: { active: true, label: { notIn: [...wanted] } },
      data: { active: false },
    }),
  ]);
}
