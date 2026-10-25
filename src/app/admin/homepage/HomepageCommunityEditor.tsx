"use client";

import { useState } from "react";
import { VIDEOS_HIDDEN } from "@/lib/library/texts";
import { postSettings, cardStyle } from "../settings/shared";

// The homepage as the community's home (OrgSettings.homepageCommunity):
// under the event's hero, the way into everything — and a menu. Off until
// the team is happy with the preview.
export default function HomepageCommunityEditor({ initialOn }: { initialOn: boolean }) {
  const [on, setOn] = useState(initialOn);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function toggle(next: boolean) {
    setOn(next);
    setStatus("saving");
    try {
      await postSettings({ homepageCommunity: next });
      setStatus("saved");
    } catch {
      setOn(!next);
      setStatus("error");
    }
  }

  return (
    <div style={{ ...cardStyle, marginBottom: 24, borderColor: on ? "#9fe0d5" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Portada de la comunidad</div>
          <p style={{ fontSize: 13, color: "#5b5f6b", margin: "4px 0 0", maxWidth: 560, lineHeight: 1.5 }}>
            Debajo del evento, la entrada a todo Nail Fest: {VIDEOS_HIDDEN ? "descuentos, Consultorio e instructoras" : "cortos, descuentos, Consultorio, instructoras y El Taller"},
            con lo más nuevo de cada uno, y un menú arriba. Cada parte sale cuando ya es pública.{" "}
            <a href="/?vista=comunidad" target="_blank" rel="noreferrer">
              Ver cómo queda ↗
            </a>
          </p>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" }}>
          <input type="checkbox" checked={on} disabled={status === "saving"} onChange={(e) => toggle(e.target.checked)} />
          {on ? "Activa" : "Apagada"}
        </label>
      </div>
      {status === "saved" && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#12966b" }}>{on ? "Listo: la portada de la comunidad ya es la que ve todo el mundo." : "Listo: volvió la portada de siempre."}</p>}
      {status === "error" && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b0225c" }}>No se pudo guardar. Vuelve a intentarlo.</p>}
    </div>
  );
}
