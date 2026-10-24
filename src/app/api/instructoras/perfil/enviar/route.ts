import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readyToSubmit } from "@/lib/library/portal";
import { requirePortalUser } from "@/lib/library/portalAuth";

// The onboarding's last step, "Revisar y enviar": her profile goes to the
// team, who approve it before it shows in the directory.
export async function POST() {
  const auth = await requirePortalUser();
  if ("response" in auth) return auth.response;
  const { instructor } = auth.user;

  if (instructor.submittedAt || instructor.approvedAt) return NextResponse.json({ ok: true });
  if (!readyToSubmit(instructor)) {
    return NextResponse.json({ error: "incomplete", message: "Para enviarlo te falta tu nombre, tu ciudad o al menos una especialidad." }, { status: 400 });
  }
  await db.instructor.update({ where: { id: instructor.id }, data: { submittedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
