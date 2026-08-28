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
    await fetch(`/api/admin/segments?id=${id}`, { method: "DELETE" });
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
