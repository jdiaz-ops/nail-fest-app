import { db } from "@/lib/db";
import { PROFESSIONS } from "@/lib/seed";

const RANK = new Map(PROFESSIONS.map((label, i) => [label, i]));

/**
 * Active profession options in the form's intended order (manicurista
 * first, "ninguna de las anteriores" last), not alphabetical — sorting by
 * label alphabetizes by each option's leading emoji codepoint, which comes
 * out essentially random. Anything not in the known PROFESSIONS list (e.g.
 * an unmapped value from a future city's import — see docs/IMPORT.md)
 * sorts after all the known ones, alphabetically among themselves.
 */
export async function getOrderedProfessionOptions(): Promise<string[]> {
  const rows = await db.professionOption.findMany({ where: { active: true } });
  return rows
    .map((r) => r.label)
    .sort((a, b) => {
      const ra = RANK.get(a) ?? Infinity;
      const rb = RANK.get(b) ?? Infinity;
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
}
