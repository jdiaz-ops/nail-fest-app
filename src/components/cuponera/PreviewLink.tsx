"use client";

import type { CSSProperties, ReactNode } from "react";

// Every "go to the store" link in the cuponera. With a real store URL it
// opens the store in a new tab; in the preview (sample data, url null) it
// stays put and explains what would happen instead (PreviewToast shows it).
export function showCuponeraNotice(message: string) {
  window.dispatchEvent(new CustomEvent("cuponera:aviso", { detail: message }));
}

export default function PreviewLink({
  href,
  preview,
  className,
  style,
  ariaLabel,
  children,
}: {
  href: string | null;
  preview: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  children: ReactNode;
}) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener" className={className} style={style} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  return (
    <a
      href="#"
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        showCuponeraNotice(preview);
      }}
    >
      {children}
    </a>
  );
}
