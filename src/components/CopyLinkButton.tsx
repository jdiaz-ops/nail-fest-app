"use client";

import { useState } from "react";

// «Copiar enlace»: the link to the clipboard, and «Copiado» for a moment.
export default function CopyLinkButton({ url, style }: { url: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      style={style}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        } catch {
          window.prompt("Copia el enlace:", url);
        }
      }}
    >
      {copied ? "Copiado" : "Copiar enlace"}
    </button>
  );
}
