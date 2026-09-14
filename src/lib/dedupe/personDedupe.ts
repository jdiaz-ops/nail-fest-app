import { levenshtein } from "@/lib/email/qualityCheck";

// Turns "same phone, 2+ Person rows" (a real signal, not proof — see
// duplicate-check/route.ts's own comment) into an actual decision: which
// groups are confident enough to merge automatically, and which need a
// human. Deliberately conservative — a false MERGE silently folds two
// real, distinct people's histories together under one canonical id,
// which is a much worse mistake than leaving a real duplicate unmerged
// for someone to review later. Two independent signals, either one
// sufficient on its own, both requiring the shared-phone precondition
// the caller already filtered on:
//
//   1. Same local-part (the bit before "@") on both emails, exact or
//      off-by-one-typo — e.g. "gisellinfante9@gamail.co" and
//      "gisellinfante9@gmail.com" share the phone AND the identity
//      string; only the domain got fat-fingered. Two unrelated people
//      independently landing on the same non-trivial local part while
//      also sharing a phone number is not a realistic coincidence.
//   2. Same full name (first + last), normalized (case/accents/
//      whitespace-insensitive) — catches the same person registering
//      twice with two unrelated addresses (work vs. personal), where
//      the emails share nothing but the human filled in the same name
//      both times.
//
// What this deliberately does NOT do: cluster purely on phone. A shared
// family/shop phone with different names and unrelated emails (the
// "+573133777029" example — agegolden231, harbaro, luna311071, no — all
// different) stays unmerged, reported only, exactly like the one other
// signal this app already trusts less (WhatsApp inbox's un-related
// failure codes) — see WHATSAPP_STATUS_DOCS if this ever needs updating
// to mirror how conservative that flow is.

export interface DedupePersonRow {
  id: string;
  phone: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export type MergeSignal = "same_phone_same_local_part" | "same_phone_same_name" | "same_phone_cluster";

export interface MergePlanEntry {
  canonicalId: string;
  mergedId: string;
  reason: MergeSignal;
}

export interface DedupePlan {
  /** Phone groups fully resolved into one cluster — every member merges into one canonical id. */
  merges: MergePlanEntry[];
  /** Number of distinct phone numbers that produced at least one merge. */
  autoMergedGroups: number;
  /** Phone groups where auto-clustering still leaves 2+ distinct people — needs a human, nothing written. */
  needsReview: { phone: string; people: DedupePersonRow[] }[];
}

function normalizeLocalPart(email: string): string {
  const at = email.toLowerCase().trim().indexOf("@");
  return at < 0 ? email.toLowerCase().trim() : email.slice(0, at).toLowerCase().trim();
}

function normalizeName(firstName: string | null, lastName: string | null): string | null {
  const full = [firstName, lastName].filter((s): s is string => !!s && s.trim().length > 0).join(" ");
  if (!full) return null;
  return full
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip accents (combining diacritical marks)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Direct pairwise match signal between two people, independent of any other member of their phone group. */
function matchSignal(a: DedupePersonRow, b: DedupePersonRow): MergeSignal | null {
  const localA = normalizeLocalPart(a.email);
  const localB = normalizeLocalPart(b.email);
  if (localA && localA === localB) return "same_phone_same_local_part";
  // Off-by-one typo tolerance, only for identity strings long enough that
  // a 1-char coincidence between two unrelated people is implausible.
  if (localA.length >= 6 && localB.length >= 6 && Math.abs(localA.length - localB.length) <= 1 && levenshtein(localA, localB) <= 1) {
    return "same_phone_same_local_part";
  }
  const nameA = normalizeName(a.firstName, a.lastName);
  const nameB = normalizeName(b.firstName, b.lastName);
  if (nameA && nameB && nameA === nameB) return "same_phone_same_name";
  return null;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    let root = id;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // path compression
    let cur = id;
    while (this.parent.get(cur) !== root) {
      const next = this.parent.get(cur)!;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

/** Earliest registrant wins as canonical — deterministic, and the closest
 * thing to "the profile that was actually there first" without needing
 * a separate registrations-count lookup. */
function chooseCanonical(cluster: DedupePersonRow[]): DedupePersonRow {
  return [...cluster].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0]!;
}

/** Builds the merge plan for ONE phone group (2+ people sharing a phone).
 * Pure — no DB access — so the same clustering logic backs both the
 * dry-run preview and the actual apply. */
export function planGroupMerges(phone: string, people: DedupePersonRow[]): {
  merges: MergePlanEntry[];
  fullyResolved: boolean;
} {
  const uf = new UnionFind();
  for (const p of people) uf.find(p.id);
  for (let i = 0; i < people.length; i++) {
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i]!;
      const b = people[j]!;
      if (matchSignal(a, b)) uf.union(a.id, b.id);
    }
  }

  const clusters = new Map<string, DedupePersonRow[]>();
  for (const p of people) {
    const root = uf.find(p.id);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root)!.push(p);
  }

  // Fully resolved only when the whole phone group collapsed into ONE
  // cluster — a group that splits into 2+ clusters still has real
  // ambiguity left (which of the surviving clusters, if any, is "the"
  // person?) and is reported for review instead of partially merged.
  if (clusters.size !== 1) {
    return { merges: [], fullyResolved: false };
  }

  const cluster = people;
  if (cluster.length < 2) return { merges: [], fullyResolved: true };

  const canonical = chooseCanonical(cluster);
  const merges: MergePlanEntry[] = [];
  for (const person of cluster) {
    if (person.id === canonical.id) continue;
    const directSignal = matchSignal(person, canonical);
    merges.push({ canonicalId: canonical.id, mergedId: person.id, reason: directSignal ?? "same_phone_cluster" });
  }
  return { merges, fullyResolved: true };
}

/** Builds the full plan across every phone group. `groups` is keyed by
 * phone, each value the 2+ Person rows sharing it. */
export function planAllMerges(groups: Map<string, DedupePersonRow[]>): DedupePlan {
  const merges: MergePlanEntry[] = [];
  const needsReview: DedupePlan["needsReview"] = [];
  let autoMergedGroups = 0;

  for (const [phone, people] of groups) {
    const { merges: groupMerges, fullyResolved } = planGroupMerges(phone, people);
    if (!fullyResolved) {
      needsReview.push({ phone, people });
      continue;
    }
    if (groupMerges.length > 0) {
      autoMergedGroups++;
      merges.push(...groupMerges);
    }
  }

  return { merges, autoMergedGroups, needsReview };
}
