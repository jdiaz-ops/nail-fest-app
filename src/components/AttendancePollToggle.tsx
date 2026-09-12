"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Plantillas' own per-row switch for WhatsAppTemplate.isAttendancePoll —
// see that field's own schema comment. Deliberately a plain toggle, not a
// picker of some kind: at most one template genuinely needs this at a
// time (the current pre-event "¿vienes?" poll), and turning it on for a
// new one doesn't need turning the old one off first — the webhook only
// ever looks at the ONE template a given reply's own broadcast actually
// used, never "whichever template is flagged" in the abstract.
export default function AttendancePollToggle({ templateId, initialValue }: { templateId: string; initialValue: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const next = !value;
    const res = await fetch(`/api/admin/whatsapp/templates/${templateId}/attendance-poll`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAttendancePoll: next }),
    });
    setSaving(false);
    if (res.ok) {
      setValue(next);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      title="Marca esta plantilla como la encuesta de asistencia (Sí/No) antes del evento"
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 999,
        border: value ? "1px solid #12966b" : "1px solid #e3e1dc",
        background: value ? "#e3f4ec" : "#fff",
        color: value ? "#0e6b4c" : "#5b5f6b",
        cursor: saving ? "default" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {value ? "✓ Encuesta de asistencia" : "Marcar como encuesta de asistencia"}
    </button>
  );
}
