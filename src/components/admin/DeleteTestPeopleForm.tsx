"use client";

import { useState } from "react";

interface MatchedPerson {
  email: string;
  name: string | null;
  createdAt: string;
  registrations: number;
  consents: number;
  whatsappConversations: number;
}

interface Result {
  applied: boolean;
  matched: MatchedPerson[];
  notFound: string[];
}

export default function DeleteTestPeopleForm() {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [preview, setPreview] = useState<Result | null>(null);
  const [deleted, setDeleted] = useState<Result | null>(null);

  function parseEmails(): string[] {
    return text
      .split(/[\s,;]+/)
      .map((e) => e.trim())
      .filter(Boolean);
  }

  async function run(apply: boolean) {
    const emails = parseEmails();
    if (emails.length === 0) return;
    setState("loading");
    const res = await fetch("/api/admin/dev/delete-test-people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails, apply }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      if (apply) {
        setDeleted(body);
        setPreview(null);
      } else {
        setPreview(body);
      }
      setState("idle");
    } else {
      setState("error");
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>
        Correos a borrar (uno por línea, o separados por coma)
      </label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
          setDeleted(null);
        }}
        rows={6}
        placeholder={"j.diaz@gaail.com\nj.diaz@ei-montpellr.co\n..."}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #e3e1dc", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit" }}
      />

      <div style={{ marginTop: 12 }}>
        <button type="button" onClick={() => run(false)} disabled={state === "loading" || text.trim().length === 0}>
          {state === "loading" ? "Buscando..." : "Buscar (vista previa, no borra nada)"}
        </button>
      </div>

      {state === "error" && <p style={{ fontSize: 12, color: "#c2185b", margin: "10px 0 0" }}>Algo salió mal. Intenta de nuevo.</p>}

      {preview && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            {preview.matched.length} de {preview.matched.length + preview.notFound.length} encontrados — esto es lo que se borraría
            PERMANENTEMENTE:
          </p>
          <div className="admin-table-wrap" style={{ border: "1px solid #e3e1dc", borderRadius: 10, marginBottom: 12 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#faf9f7" }}>
                  <th style={{ padding: "8px 12px" }}>Correo</th>
                  <th style={{ padding: "8px 12px" }}>Nombre</th>
                  <th style={{ padding: "8px 12px" }}>Registros</th>
                  <th style={{ padding: "8px 12px" }}>Consentimientos</th>
                  <th style={{ padding: "8px 12px" }}>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {preview.matched.map((p) => (
                  <tr key={p.email} style={{ borderTop: "1px solid #f0efec" }}>
                    <td style={{ padding: "8px 12px" }}>{p.email}</td>
                    <td style={{ padding: "8px 12px", color: "#5b5f6b" }}>{p.name ?? "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{p.registrations}</td>
                    <td style={{ padding: "8px 12px" }}>{p.consents}</td>
                    <td style={{ padding: "8px 12px" }}>{p.whatsappConversations}</td>
                  </tr>
                ))}
                {preview.matched.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "8px 12px", color: "#5b5f6b" }}>
                      Ninguno de esos correos existe en la base.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {preview.notFound.length > 0 && (
            <p style={{ fontSize: 12, color: "#5b5f6b", marginBottom: 12 }}>
              No encontrados (ya no existen o el correo tiene un typo): {preview.notFound.join(", ")}
            </p>
          )}
          {preview.matched.length > 0 && (
            <button
              type="button"
              onClick={() => run(true)}
              disabled={state === "loading"}
              style={{ background: "#a3251f", color: "#fff", border: "none" }}
            >
              {state === "loading" ? "Borrando..." : `Sí, borrar estos ${preview.matched.length} permanentemente`}
            </button>
          )}
        </div>
      )}

      {deleted && (
        <div
          style={{
            marginTop: 20,
            padding: "10px 14px",
            borderRadius: 8,
            background: "#e6f9f7",
            color: "#0e6b4c",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          ✓ {deleted.matched.length} personas borradas permanentemente (con sus registros, consentimientos y conversaciones de
          WhatsApp).
        </div>
      )}
    </div>
  );
}
