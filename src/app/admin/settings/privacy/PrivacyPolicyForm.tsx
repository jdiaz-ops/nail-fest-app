"use client";

import { useState } from "react";
import { COMMUNITY_PRIVACY_TEXT } from "@/lib/communityPrivacy";
import { postSettings, cardStyle, saveButtonStyle } from "../shared";

// The policy at /privacidad: the main text, and its community part below
// it (the library, the cortos, the instructors, the Consultorio, the
// newsletters and their polls) — which starts as the usual text.
export default function PrivacyPolicyForm({ initialText, initialCommunityText }: { initialText: string; initialCommunityText: string | null }) {
  const [text, setText] = useState(initialText);
  const [community, setCommunity] = useState(initialCommunityText ?? COMMUNITY_PRIVACY_TEXT);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      // The usual text untouched is saved as "the usual one", so it keeps up with later updates.
      await postSettings({ privacyPolicyText: text, communityPrivacyText: community.trim() === COMMUNITY_PRIVACY_TEXT ? "" : community });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} style={cardStyle}>
      <div className="field">
        <label htmlFor="privacyText">Texto (texto plano — párrafos separados por línea en blanco)</label>
        <textarea
          id="privacyText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={14}
          style={{ fontFamily: "inherit", resize: "vertical" }}
        />
      </div>
      <div className="field">
        <label htmlFor="communityPrivacyText">La comunidad Nail Fest (sale debajo del texto principal)</label>
        <textarea
          id="communityPrivacyText"
          value={community}
          onChange={(e) => setCommunity(e.target.value)}
          rows={18}
          style={{ fontFamily: "inherit", resize: "vertical" }}
        />
        <span style={{ fontSize: 12, color: "#5b5f6b" }}>
          El Taller y Explorar, las instructoras, el Consultorio, los correos y sus encuestas, y la galería. Una línea que empieza con «## » es un
          título; {"{correo}"} se cambia por el correo de respuesta de Configuración.{" "}
          {community.trim() !== COMMUNITY_PRIVACY_TEXT && (
            <button type="button" onClick={() => setCommunity(COMMUNITY_PRIVACY_TEXT)} style={{ border: 0, background: "none", padding: 0, color: "#007a74", fontWeight: 700, cursor: "pointer" }}>
              Volver al texto de siempre
            </button>
          )}
        </span>
      </div>
      <button type="submit" style={saveButtonStyle} disabled={status === "saving"}>
        {status === "saving" ? "Guardando…" : "Guardar"}
      </button>
      {status === "saved" && <span style={{ marginLeft: 12, color: "#12966b", fontSize: 14 }}>Guardado ✓</span>}
      {status === "error" && <span style={{ marginLeft: 12, color: "#c2185b", fontSize: 14 }}>Error al guardar</span>}
    </form>
  );
}
