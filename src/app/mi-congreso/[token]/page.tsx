import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findCongreso } from "@/lib/imparables/miCongreso";
import MiCongreso from "@/components/imparables/MiCongreso";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu congreso",
  robots: { index: false },
};

// «Grabaciones» in the admin (the team, 2026-11-04): each buyer's own page for Manicuristas Imparables — the
// recordings, nothing else (components/imparables/MiCongreso.tsx). Her link is signed (lib/imparables/miCongreso.ts): it
// opens her page once her purchase is confirmed, a note to come back while it's being confirmed, and nothing for
// anyone else. The team's sample link opens the same page for its event, with sample data.
export default async function MiCongresoPage({ params }: { params: { token: string } }) {
  const access = await findCongreso(params.token);
  if (!access) notFound();
  if (access.kind === "sample") {
    return <MiCongreso event={access.event} sample />;
  }
  return <MiCongreso event={access.event} waiting={access.waiting} />;
}
