"use client";

import { useEffect } from "react";

// Counts one view of a video's page ("Lo más visto esta semana") — from the
// browser, so a link preview or a prefetch never counts as someone watching.
export default function ViewPing({ videoId }: { videoId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ videoId });
    if (navigator.sendBeacon?.("/api/library/views", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/library/views", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
      // A view not counted is no reason to bother anyone.
    });
  }, [videoId]);
  return null;
}
