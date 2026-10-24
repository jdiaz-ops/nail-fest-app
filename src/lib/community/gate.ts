import { NextResponse } from "next/server";
import { getLibrarySettings } from "@/lib/library/settings";
import { getConsultorioIdentity, signInFirst, type ConsultorioIdentity } from "./auth";

// Who may post in the Consultorio right now, for its routes: someone
// signed in, not blocked, and — until the team publishes it — the team only.
export async function consultorioPoster(): Promise<{ identity: ConsultorioIdentity } | { response: NextResponse }> {
  const [identity, settings] = await Promise.all([getConsultorioIdentity(), getLibrarySettings()]);
  if (!identity) return { response: signInFirst() };
  if (!settings.consultorioPublished && identity.kind !== "TEAM") {
    return { response: NextResponse.json({ error: "closed", message: "El Consultorio todavía no está abierto." }, { status: 404 }) };
  }
  if (identity.kind === "MEMBER" && identity.member.blocked) {
    return { response: NextResponse.json({ error: "blocked", message: "Tu cuenta no puede publicar en el Consultorio. Si crees que es un error, escríbenos." }, { status: 403 }) };
  }
  return { identity };
}

/** Her own folder for the photos she uploads. */
export function photoFolderOf(identity: ConsultorioIdentity): string {
  if (identity.kind === "MEMBER") return `consultorio/m-${identity.member.id}`;
  if (identity.kind === "INSTRUCTOR") return `consultorio/i-${identity.instructor.id}`;
  return "consultorio/equipo";
}

/** A photo uploaded by this person (Vercel Blob, her own folder). */
export function isOwnConsultorioPhoto(url: string, identity: ConsultorioIdentity): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/${photoFolderOf(identity)}/`);
  } catch {
    return false;
  }
}
