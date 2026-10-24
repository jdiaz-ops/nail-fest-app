import { redirect } from "next/navigation";

// nailfest.lat/biblioteca/shorties is called Cortos since 2026-10-24
// (./../cortos): the links already shared keep working, with their video.
export default function ShortiesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  for (const key of ["v", "tema"]) {
    const value = searchParams[key];
    if (typeof value === "string" && /^[a-z0-9-]{1,120}$/.test(value)) params.set(key, value);
  }
  const query = params.toString();
  redirect(`/biblioteca/cortos${query ? `?${query}` : ""}`);
}
