"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { countTemplateVariables } from "@/lib/whatsapp/templateText";

const SUGGESTED_NAME = "reabrir_chat";
const SUGGESTED_BODY = "Hola {{1}}, ¿cómo estás? Te escribimos de Nail Fest para retomar nuestra conversación. ¿Podemos ayudarte en algo?";

// The one template the inbox needs most: a way to write to someone whose
// 24h window closed. Prefilled, editable, one click to submit to Meta for
// review — then it shows up in the thread composer once APPROVED. Quick
// replies on purpose: a tap is an inbound message, which reopens the
// window for free text.
export default function WhatsAppReopenTemplateSuggestion() {
  const router = useRouter();
  const [body, setBody] = useState(SUGGESTED_BODY);
  const [category, setCategory] = useState<"MARKETING" | "UTILITY">("MARKETING");
  const [replies, setReplies] = useState(["Sí, claro", "Ahora no"]);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const variableCount = useMemo(() => countTemplateVariables(body), [body]);

  async function submit() {
    setStatus("saving");
    setMessage(null);
    const examples = Array.from({ length: variableCount }, (_, i) => (i === 0 ? "Karen" : "ejemplo"));
    const res = await fetch("/api/admin/whatsapp/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: SUGGESTED_NAME,
        language: "es",
        category,
        bodyText: body,
        bodyExamples: examples,
        buttons: replies.filter((r) => r.trim()).map((text) => ({ type: "QUICK_REPLY", text: text.trim() })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setStatus("done");
      setMessage("Enviada a Meta para revisión. Cuando quede aprobada (sincroniza para verlo), aparece en el chat cuando la ventana está cerrada.");
      router.refresh();
    } else {
      setStatus("error");
      setMessage(data?.message ?? `No se pudo crear: ${data?.error ?? "error"}`);
    }
  }

  const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "8px 10px", border: "1px solid #e3e1dc", borderRadius: 8, font: "inherit", fontSize: 13.5, background: "#fff" };

  return (
    <div style={{ border: "1px solid #e3e1dc", background: "#fdf1e6", borderRadius: 12, padding: "14px 16px", marginTop: 16, maxWidth: 720, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Plantilla para reabrir un chat</div>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#5b5f6b", lineHeight: 1.45 }}>
          Cuando pasan 24 h sin respuesta de la persona, WhatsApp cierra la ventana y el equipo no puede escribirle texto libre. Con esta plantilla aprobada, en la Bandeja aparece un botón para reabrir la conversación. Los botones de respuesta rápida ayudan: con un toque la persona reabre la ventana.
        </p>
      </div>
      {status === "done" ? (
        <p style={{ margin: 0, fontSize: 13, color: "#0e6b4c", fontWeight: 600 }}>{message}</p>
      ) : (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600 }}>
            Texto ({"{{1}}"} es el nombre de la persona)
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} style={{ ...inputStyle, fontWeight: 400, resize: "vertical" }} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {replies.map((r, i) => (
              <label key={i} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600 }}>
                Botón {i + 1}
                <input value={r} onChange={(e) => setReplies((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} style={{ ...inputStyle, fontWeight: 400 }} />
              </label>
            ))}
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 600 }}>
              Categoría
              <select value={category} onChange={(e) => setCategory(e.target.value as "MARKETING" | "UTILITY")} style={{ ...inputStyle, fontWeight: 400 }}>
                <option value="MARKETING">Marketing (la que Meta suele aprobar para un saludo)</option>
                <option value="UTILITY">Utilidad</option>
              </select>
            </label>
          </div>
          {message && <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>{message}</p>}
          <button className="primary" type="button" onClick={submit} disabled={status === "saving" || !body.trim()} style={{ width: "auto", padding: "9px 18px", alignSelf: "flex-start" }}>
            {status === "saving" ? "Enviando a Meta…" : `Crear "${SUGGESTED_NAME}" y enviar a revisión`}
          </button>
        </>
      )}
    </div>
  );
}
