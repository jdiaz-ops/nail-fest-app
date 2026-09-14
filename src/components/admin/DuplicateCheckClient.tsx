"use client";

import { useState } from "react";

interface PhoneGroup {
  phone: string;
  count: number;
  emails: string[];
}

interface Result {
  emailDuplicateGroups: { email: string; count: number }[];
  totalPhoneGroups: number;
  totalExtraProfiles: number;
  phoneDuplicateGroups: PhoneGroup[];
  phoneGroupsTruncated: boolean;
}

export default function DuplicateCheckClient() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);

  async function check() {
    setState("loading");
    const res = await fetch("/api/admin/crm/duplicate-check", { method: "POST" });
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
      <button type="button" onClick={check} disabled={state === "loading"}>
        {state === "loading" ? "Revisando..." : "Revisar duplicados"}
      </button>
      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}

      {result && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 16,
              background: result.emailDuplicateGroups.length === 0 ? "#e6f9f7" : "#fdeaea",
              color: result.emailDuplicateGroups.length === 0 ? "#0e6b4c" : "#a3251f",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {result.emailDuplicateGroups.length === 0
              ? "✓ Cero correos duplicados exactos — confirmado, no aproximado."
              : `⚠ ${result.emailDuplicateGroups.length} correos aparecen más de una vez — esto no debería pasar nunca, avísame.`}
          </div>

          <h3 style={{ fontSize: 14, marginBottom: 4 }}>
            {result.totalPhoneGroups.toLocaleString("es-CO")} números de teléfono con 2+ perfiles distintos — hasta{" "}
            {result.totalExtraProfiles.toLocaleString("es-CO")} perfiles podrían ser la misma persona repetida
          </h3>
          <p style={{ fontSize: 12.5, color: "#5b5f6b", marginBottom: 12 }}>
            No significa que sean duplicados de verdad — un teléfono familiar compartido es legítimo — pero es la señal más fuerte que
            hay de "misma persona, dos correos". Revísalos antes de asumir que tu base con consentimiento activo son todas personas
            distintas.
          </p>

          {result.phoneGroupsTruncated && (
            <p style={{ fontSize: 12, color: "#8a5a1f", marginBottom: 12 }}>
              Mostrando solo los primeros {result.phoneDuplicateGroups.length.toLocaleString("es-CO")} grupos (los de más perfiles
              repetidos) — los totales de arriba sí cuentan los {result.totalPhoneGroups.toLocaleString("es-CO")} grupos completos.
            </p>
          )}

          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, maxHeight: 400, overflowY: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7", position: "sticky", top: 0 }}>
                  <th style={{ padding: "8px 12px" }}>Teléfono</th>
                  <th style={{ padding: "8px 12px" }}>Perfiles</th>
                  <th style={{ padding: "8px 12px" }}>Correos</th>
                </tr>
              </thead>
              <tbody>
                {result.phoneDuplicateGroups.map((g) => (
                  <tr key={g.phone} style={{ borderTop: "1px solid #f0efec" }}>
                    <td style={{ padding: "8px 12px" }}>{g.phone}</td>
                    <td style={{ padding: "8px 12px" }}>{g.count}</td>
                    <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{g.emails.join(", ")}</td>
                  </tr>
                ))}
                {result.phoneDuplicateGroups.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                      Ningún teléfono se repite entre perfiles distintos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
