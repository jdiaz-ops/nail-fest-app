"use client";

import { useState } from "react";

type FixCategory = "missing_57_entirely" | "wrong_code_extra1" | "wrong_code_swap";
type ReviewCategory = "missing_57_and_truncated" | "co_ambiguous_shape" | "ambiguous_other";

interface FixEntry {
  from: string;
  to: string;
  category: FixCategory;
}
interface ReviewEntry {
  id: string;
  phone: string;
  category: ReviewCategory;
  name: string | null;
  email: string;
}
interface Result {
  applied: boolean;
  totalChecked: number;
  fixableCount: number;
  needsReviewCount: number;
  countByCategory: Record<string, number>;
  fixPreview: FixEntry[];
  needsReviewPreview: ReviewEntry[];
}

const FIX_LABEL: Record<FixCategory, string> = {
  missing_57_entirely: "Sin +57 (el número ya es un celular CO completo)",
  wrong_code_extra1: "Un '1' de más pegado al inicio",
  wrong_code_swap: "Código de país equivocado (celular CO real detrás)",
};
const REVIEW_LABEL: Record<ReviewCategory, string> = {
  missing_57_and_truncated: "Sin +57 y con un dígito de menos — no se puede completar solo",
  co_ambiguous_shape: "10 dígitos con +57, pero no arranca como celular ni fijo",
  ambiguous_other: "No coincide con ningún patrón reconocible",
};

export default function PhoneCountryFixClient() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [applyState, setApplyState] = useState<"idle" | "loading" | "done">("idle");
  const [suppressState, setSuppressState] = useState<"idle" | "loading" | "done">("idle");
  const [suppressResult, setSuppressResult] = useState<{ matched: number } | null>(null);

  async function analyze() {
    setState("loading");
    const res = await fetch("/api/admin/crm/fix-phone-country", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apply: false }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setResult(body);
      setState("idle");
    } else {
      setState("error");
    }
  }

  async function apply() {
    setApplyState("loading");
    const res = await fetch("/api/admin/crm/fix-phone-country", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apply: true }) });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      setResult(body);
      setApplyState("done");
    } else {
      setState("error");
    }
  }

  async function suppressReviewList() {
    if (!result) return;
    setSuppressState("loading");
    const personIds = result.needsReviewPreview.map((r) => r.id);
    const res = await fetch("/api/admin/crm/suppress-phones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personIds }),
    });
    const body = await res.json().catch(() => ({}));
    setSuppressState("done");
    if (res.ok && body.ok) setSuppressResult({ matched: body.matched });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={analyze} disabled={state === "loading"}>
          {state === "loading" ? "Analizando..." : "Analizar códigos de país"}
        </button>
        {result && !result.applied && result.fixableCount > 0 && (
          <button type="button" className="primary" style={{ width: "auto" }} onClick={apply} disabled={applyState === "loading"}>
            {applyState === "loading" ? "Corrigiendo..." : `Corregir ${result.fixableCount} números de una vez`}
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
              ? `✓ ${result.fixableCount} números corregidos — reemplazado el valor guardado por el correcto.`
              : `${result.totalChecked.toLocaleString("es-CO")} revisados → ${result.fixableCount} corregibles con confianza, ${result.needsReviewCount} necesitan revisión.`}
          </div>
          <p style={{ fontSize: 12.5, color: "#5b5f6b", marginBottom: 16, maxWidth: 720 }}>
            Solo se corrige cuando, quitando el código de país guardado, lo que queda es exactamente un celular colombiano de 10
            dígitos empezando en 3 — nunca una adivinanza de qué dígito sobra o falta.
          </p>

          {result.fixPreview.length > 0 && (
            <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, maxHeight: 300, overflowY: "auto", marginBottom: 20 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
                <thead>
                  <tr style={{ textAlign: "left", background: "#faf9f7", position: "sticky", top: 0 }}>
                    <th style={{ padding: "8px 12px" }}>Antes</th>
                    <th style={{ padding: "8px 12px" }}>Después</th>
                    <th style={{ padding: "8px 12px" }}>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.fixPreview.map((f, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f0efec" }}>
                      <td style={{ padding: "8px 12px", color: "#a3251f" }}>{f.from}</td>
                      <td style={{ padding: "8px 12px", color: "#0e6b4c" }}>{f.to}</td>
                      <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{FIX_LABEL[f.category]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.needsReviewCount > 0 && (
            <div>
              <h3 style={{ fontSize: 14, marginBottom: 4 }}>{result.needsReviewCount} necesitan revisión humana</h3>
              <p style={{ fontSize: 12.5, color: "#5b5f6b", marginBottom: 10 }}>
                No hay una corrección segura para estos. Puedes suprimirlos de WhatsApp (dejan de intentarse en cada envío) mientras
                los revisas, sin tocar correo ni ningún otro dato.
              </p>
              <button type="button" onClick={suppressReviewList} disabled={suppressState === "loading"}>
                {suppressState === "loading" ? "Suprimiendo..." : `Suprimir estos ${result.needsReviewPreview.length} de WhatsApp`}
              </button>
              {suppressResult && (
                <p style={{ fontSize: 12.5, color: "#5b5f6b", margin: "8px 0 0" }}>✓ {suppressResult.matched} suprimidos de WhatsApp.</p>
              )}
              <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, maxHeight: 300, overflowY: "auto", marginTop: 12 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
                  <thead>
                    <tr style={{ textAlign: "left", background: "#faf9f7", position: "sticky", top: 0 }}>
                      <th style={{ padding: "8px 12px" }}>Nombre</th>
                      <th style={{ padding: "8px 12px" }}>Correo</th>
                      <th style={{ padding: "8px 12px" }}>Teléfono</th>
                      <th style={{ padding: "8px 12px" }}>Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.needsReviewPreview.map((r) => (
                      <tr key={r.id} style={{ borderTop: "1px solid #f0efec" }}>
                        <td style={{ padding: "8px 12px" }}>{r.name ?? "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{r.email}</td>
                        <td style={{ padding: "8px 12px" }}>{r.phone}</td>
                        <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{REVIEW_LABEL[r.category]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
