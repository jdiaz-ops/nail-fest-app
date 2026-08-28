import { getOrgSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const settings = await getOrgSettings();
  const paragraphs = (settings.privacyPolicyText ?? "").split(/\n\s*\n/).filter((p) => p.trim());

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
    </main>
  );
}
