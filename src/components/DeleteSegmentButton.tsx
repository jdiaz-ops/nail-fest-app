"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteSegmentButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("¿Borrar este segmento? No borra la audiencia ya creada en Meta, solo deja de actualizarla.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/segments?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      // E.g. a sequence uses it (2026-10-30): the route says which.
      const body = await res.json().catch(() => ({}));
      alert(body.message ?? "No se pudo borrar el segmento.");
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      style={{
        background: "none",
        border: "none",
        color: "#c2185b",
        cursor: "pointer",
        fontSize: 13,
        padding: 0,
      }}
    >
      {busy ? "..." : "Borrar"}
    </button>
  );
}
