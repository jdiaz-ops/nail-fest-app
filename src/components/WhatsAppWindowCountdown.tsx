"use client";

import { useEffect, useState } from "react";

const WINDOW_MS = 24 * 60 * 60 * 1000;

function format(remainingMs: number): string {
  if (remainingMs <= 0) return "Cerrada";
  const totalSeconds = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// WhatChimp's own "Inside 24H — 6:46:17" live countdown in the Chat
// Actions panel — ticks client-side from the same lastInboundAt the
// server already uses to decide whether a FREEFORM reply is allowed
// (see the reply API route's own WINDOW_MS), so this display can never
// disagree with what actually gets enforced.
export default function WhatsAppWindowCountdown({ lastInboundAt }: { lastInboundAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!lastInboundAt) {
    return <span style={{ color: "#b5b0a6", fontWeight: 600 }}>Sin mensajes entrantes</span>;
  }

  const deadline = new Date(lastInboundAt).getTime() + WINDOW_MS;
  const remaining = deadline - now;
  const open = remaining > 0;

  return (
    <span style={{ color: open ? "#12966b" : "#b5b0a6", fontWeight: 600 }}>
      {open ? `Ventana abierta — ${format(remaining)}` : "Ventana cerrada"}
    </span>
  );
}
