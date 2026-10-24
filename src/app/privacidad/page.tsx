import { getOrgSettings } from "@/lib/settings";
import { COMMUNITY_PRIVACY_TEXT, policyBlocks } from "@/lib/communityPrivacy";

export const dynamic = "force-dynamic";

// nailfest.lat/privacidad — the admin's own policy text (Configuración →
// Política de privacidad), then its community part: the library and the
// cortos, the instructors, the Consultorio, the newsletters and their
// polls, the gallery (lib/communityPrivacy.ts).
export default async function PrivacyPolicyPage() {
  const settings = await getOrgSettings();
  const paragraphs = (settings.privacyPolicyText ?? "").split(/\n\s*\n/).filter((p) => p.trim());
  const community = policyBlocks(settings.communityPrivacyText ?? COMMUNITY_PRIVACY_TEXT, settings.replyToEmail);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 24 }}>Política de privacidad — {settings.name}</h1>
      {paragraphs.length === 0 ? (
        <p style={{ color: "#5b5f6b" }}>Aún no hemos publicado el texto de esta política.</p>
      ) : (
        paragraphs.map((p, i) => (
          <p key={i} style={{ lineHeight: 1.6 }}>
            {p}
          </p>
        ))
      )}
      <section id="comunidad" style={{ marginTop: 40, paddingTop: 8, borderTop: "1px solid #e3e1dc" }}>
        {community.map((block, i) =>
          block.kind === "heading" ? (
            <h2 key={i} style={{ fontSize: i === 0 ? 21 : 17, margin: i === 0 ? "24px 0 8px" : "22px 0 6px" }}>
              {block.text}
            </h2>
          ) : (
            <p key={i} style={{ lineHeight: 1.6, margin: "0 0 12px" }}>
              {block.text}
            </p>
          ),
        )}
      </section>
    </main>
  );
}
