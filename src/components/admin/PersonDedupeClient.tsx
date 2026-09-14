"use client";

import { useState } from "react";

interface ReviewGroup {
  phone: string;
  people: { email: string; firstName: string | null; lastName: string | null }[];
}

interface Result {
  applied: boolean;
  totalGroupsScanned: number;
  autoMergedGroups: number;
  autoMergedExtraProfiles: number;
  needsReviewGroups: number;
  needsReviewPreview: ReviewGroup[];
  needsReviewTruncated: boolean;
}

export default function PersonDedupeClient() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);

  async function run(apply: boolean) {
    setState("loading");
    const res = await fetch("/api/admin/crm/dedupe-people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apply }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setResult(body);
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={() => run(false)} disabled={state === "loading"}>
          {state === "loading" ? "Analizando..." : "Analizar duplicados"}
        </button>
        {result && !result.applied && result.autoMergedExtraProfiles > 0 && (
          <button type="button" className="primary" style={{ width: "auto" }} onClick={() => run(true)} disabled={state === "loading"}>
            {state === "loading" ? "Fusionando..." : `Fusionar ${result.autoMergedExtraProfiles} perfiles de alta confianza`}
          </button>
        )}
      </div>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 12,
              background: "#e6f9f7",
              color: "#0e6b4c",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {result.applied
              ? `✓ Fusionados ${result.autoMergedExtraProfiles} perfiles en ${result.autoMergedGroups} grupos — nada se borró, quedan marcados como "mismo humano que" su perfil principal.`
              : `${result.totalGroupsScanned} números de teléfono con 2+ perfiles → ${result.autoMergedGroups} grupos (${result.autoMergedExtraProfiles} perfiles) se pueden fusionar con alta confianza.`}
          </div>

          <p style={{ fontSize: 12.5, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
            Solo se fusiona automáticamente cuando el mismo teléfono además comparte el mismo usuario de correo (ej. mismo texto antes
            de la @, con el dominio mal escrito) o el mismo nombre completo (sin importar tildes) — nunca solo por compartir teléfono.
            Nada se borra: los registros, consentimientos y correos enviados de cada perfil siguen intactos; solo queda anotado cuál es
            "el mismo humano que" cuál, para poder contar personas únicas con precisión.
          </p>

          <h3 style={{ fontSize: 14, marginBottom: 4 }}>{result.needsReviewGroups} grupos necesitan revisión humana</h3>
          <p style={{ fontSize: 12.5, color: "#5b5f6b", marginBottom: 12 }}>
            Comparten teléfono pero no coinciden en usuario de correo ni nombre completo — puede ser un teléfono familiar/de negocio
            compartido por personas distintas. No se tocan.
          </p>

          {result.needsReviewGroups > 0 && (
            <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, maxHeight: 400, overflowY: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#faf9f7", position: "sticky", top: 0 }}>
                    <th style={{ padding: "8px 12px" }}>Teléfono</th>
                    <th style={{ padding: "8px 12px" }}>Perfiles</th>
                  </tr>
                </thead>
                <tbody>
                  {result.needsReviewPreview.map((g) => (
                    <tr key={g.phone} style={{ borderTop: "1px solid #f0efec" }}>
                      <td style={{ padding: "8px 12px", verticalAlign: "top" }}>{g.phone}</td>
                      <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                        {g.people.map((p) => [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email).join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result.needsReviewTruncated && (
            <p style={{ fontSize: 12, color: "#8a5a1f", marginTop: 8 }}>
              Mostrando solo los primeros {result.needsReviewPreview.length} grupos que necesitan revisión.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
