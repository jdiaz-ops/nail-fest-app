"use client";

import { useEffect, useState } from "react";

// The one-line note PreviewLink raises in the preview ("aquí se abriría la
// tienda de…"), bottom-center, gone after a few seconds.
export default function PreviewToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onNotice = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 3800);
    };
    window.addEventListener("cuponera:aviso", onNotice);
    return () => {
      window.removeEventListener("cuponera:aviso", onNotice);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="cup-toast-slot">
      {message && <div className="cup-toast">{message}</div>}
    </div>
  );
}
