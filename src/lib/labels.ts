import { db } from "@/lib/db";

/** Case-sensitive exact match, created on first use — same "type a name
 * and hit enter to create" UX as WhatChimp's own Labels field. Reused
 * everywhere a label gets attached (broadcast "assign after send",
 * conversation/person labeling) so two different call sites typing the
 * same name never end up with two rows. */
export async function getOrCreateLabel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Label name cannot be empty");
  return db.label.upsert({
    where: { name: trimmed },
    create: { name: trimmed },
    update: {},
  });
}

export async function listLabels() {
  return db.label.findMany({ orderBy: { name: "asc" } });
}
