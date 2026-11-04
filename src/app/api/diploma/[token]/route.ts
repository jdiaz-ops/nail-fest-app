import { NextRequest, NextResponse } from "next/server";
import { getOrgSettings } from "@/lib/settings";
import { confirmationCodeFor } from "@/lib/ticket";
import { renderDiplomaPdf } from "@/lib/imparables/diploma";
import { diplomaDataOf, diplomaName, SAMPLE_DIPLOMA } from "@/lib/imparables/diplomaText";
import { congressTimes, readRecordings } from "@/lib/imparables/grabaciones";
import { findCongreso } from "@/lib/imparables/miCongreso";

export const dynamic = "force-dynamic";

// Her diploma of Manicuristas Imparables (lib/imparables/diploma.ts), from her page («Tu congreso»): the token is her
// page's own, so it's the same key — her name on it, her ticket's code as its number. Only once her payment is
// confirmed and the congress is over. The team's sample token draws the sample's, at any time. ?descargar saves it
// instead of opening it.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const access = await findCongreso(params.token);
  if (!access || (access.kind === "buyer" && access.waiting)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { timezone } = await getOrgSettings();

  let data;
  if (access.kind === "sample") {
    data = diplomaDataOf(access.event, SAMPLE_DIPLOMA.name, SAMPLE_DIPLOMA.code, timezone);
  } else {
    const { ends } = congressTimes(access.event, readRecordings(access.event.recordings), timezone);
    if (Date.now() < ends.getTime()) return NextResponse.json({ error: "not_yet" }, { status: 403 });
    const name = diplomaName(access.registration.person.firstName, access.registration.person.lastName);
    if (!name) return NextResponse.json({ error: "no_name" }, { status: 404 });
    data = diplomaDataOf(access.event, name, confirmationCodeFor(access.registration.id), timezone);
  }

  const pdf = await renderDiplomaPdf(data);
  const slug = data.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const disposition = req.nextUrl.searchParams.has("descargar") ? "attachment" : "inline";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="diploma-imparables${slug ? `-${slug}` : ""}.pdf"`,
      // Hers alone, and drawn from the event as it is now.
      "Cache-Control": "private, no-store",
    },
  });
}
