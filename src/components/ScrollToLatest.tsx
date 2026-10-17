"use client";

import { useEffect } from "react";

// Scrolls a thread's message container to its last message when the
// thread opens and again whenever `dep` changes (a reply just sent, a
// refresh) — a chat should open at the newest message, not at the first
// template ever sent to this person.
export default function ScrollToLatest({ containerId, dep }: { containerId: string; dep: string }) {
  useEffect(() => {
    const el = document.getElementById(containerId);
    if (el) el.scrollTop = el.scrollHeight;
  }, [containerId, dep]);
  return null;
}
