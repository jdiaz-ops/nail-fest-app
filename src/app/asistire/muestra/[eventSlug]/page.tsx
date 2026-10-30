import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import AsistireScreen from "@/components/imparables/AsistireScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuéntale a todos que vas",
  robots: { index: false },
};

// The team's own go at an event's «Asistiré» page (2026-10-30, «Después del
// pago» in its admin): the same page a buyer gets from her link, to try with
// any photo — for someone signed in, and nothing for anyone else.
export default async function AsistirePreviewPage({ params }: { params: { eventSlug: string } }) {
  const [user, event] = await Promise.all([getCurrentUser(), db.event.findUnique({ where: { slug: params.eventSlug } })]);
  if (!user || !event || event.theme !== "IMPARABLES") notFound();
  return <AsistireScreen event={event} />;
}
