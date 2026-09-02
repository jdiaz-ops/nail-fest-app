import { db } from "@/lib/db";
import type { LinkPageLink } from "@prisma/client";

// nailfest.co/links — a Linktree-equivalent the admin manages from
// /admin/links (see LinkPageLink's own schema comment). Reorder logic is
// a straight copy of lib/checkoutForm.ts's moveQuestion() — same pairwise
// order-swap, same no-op-at-the-edge behavior — there's no "locked" rows
// here, every link is movable.

export async function getOrderedLinks(): Promise<LinkPageLink[]> {
  return db.linkPageLink.findMany({ orderBy: { order: "asc" } });
}

// Public page only ever needs the enabled ones, still in order.
export async function getEnabledLinks(): Promise<LinkPageLink[]> {
  return db.linkPageLink.findMany({ where: { enabled: true }, orderBy: { order: "asc" } });
}

export async function createLink(input: {
  title: string;
  url: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
}): Promise<LinkPageLink> {
  const maxOrder = await db.linkPageLink.aggregate({ _max: { order: true } });
  return db.linkPageLink.create({
    data: {
      title: input.title,
      url: input.url,
      imageUrl: input.imageUrl ?? null,
      videoUrl: input.videoUrl ?? null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
}

export async function updateLink(
  id: string,
  patch: { title?: string; url?: string; enabled?: boolean; imageUrl?: string | null; videoUrl?: string | null }
): Promise<LinkPageLink> {
  return db.linkPageLink.update({ where: { id }, data: patch });
}

export async function deleteLink(id: string): Promise<void> {
  await db.linkPageLink.delete({ where: { id } });
}

export async function moveLink(id: string, direction: "up" | "down"): Promise<void> {
  const links = await db.linkPageLink.findMany({ orderBy: { order: "asc" } });
  const idx = links.findIndex((l) => l.id === id);
  if (idx === -1) throw new Error("not_found");
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= links.length) return; // already at that edge — no-op, not an error
  const other = links[swapIdx];
  const existing = links[idx];
  if (!other || !existing) return;
  await db.$transaction([
    db.linkPageLink.update({ where: { id: existing.id }, data: { order: other.order } }),
    db.linkPageLink.update({ where: { id: other.id }, data: { order: existing.order } }),
  ]);
}
