"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { STAFF_REACTIONS } from "@/lib/whatsapp/reactions";

const badgeStyle: CSSProperties = {
  position: "absolute",
  left: 10,
  bottom: -12,
  display: "inline-grid",
  placeItems: "center",
  minWidth: 26,
  height: 24,
  padding: "0 4px",
  borderRadius: 999,
  background: "#fff",
  border: "1px solid #ece9e3",
  boxShadow: "0 1px 3px rgba(23, 24, 28, 0.12)",
  fontSize: 14,
  lineHeight: 1,
};

// The bar's height plus its gap to the message.
const BAR_SPACE = 64;

/** The thread's own scrolling box — to tell whether the bar fits above the message. */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if (overflow === "auto" || overflow === "scroll") return node;
  }
  return null;
}

// A message the person sent, in a Bandeja thread (lib/whatsapp/reactions.ts):
// a tap opens WhatsApp's own kind of reaction bar — ❤️ and 💅 — and the one
// picked shows under their message, the way it shows in their WhatsApp.
// The same one again takes it back. When WhatsApp won't take a reaction
// (the 24h window, 30-day-old messages), the tap says why instead.
export default function WhatsAppReactable({
  conversationId,
  messageId,
  reaction,
  blockedReason,
  style,
  children,
}: {
  conversationId: string;
  messageId: string;
  reaction: string | null;
  blockedReason: string | null;
  /** Where the bubble sits in the thread (its side and width). */
  style: CSSProperties;
  children: ReactNode;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [below, setBelow] = useState(false);
  const [current, setCurrent] = useState(reaction);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the thread says after a refresh wins (a teammate may have reacted too).
  useEffect(() => setCurrent(reaction), [reaction]);

  useEffect(() => {
    if (!open) return;
    // A tap elsewhere closes it — a click, not a touch: putting a finger
    // down to scroll the thread mustn't (2026-10-25: "no desliza y no
    // puedo escogerlo").
    const onClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Once open, the thread scrolls just enough for the whole bar to show —
  // on a phone the thread can be a strip a few messages tall.
  useEffect(() => {
    if (open) bar.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [open, below]);

  const toggle = () => {
    if (!open && box.current) {
      // Above the message, as in WhatsApp, whenever there's room above it
      // in the thread (scrolling if need be); below only for the very
      // first messages, where nothing above can make room.
      const scroller = scrollParentOf(box.current);
      const top = box.current.getBoundingClientRect().top;
      const fromStart = scroller ? top - scroller.getBoundingClientRect().top + scroller.scrollTop : top + window.scrollY;
      setBelow(fromStart < BAR_SPACE);
    }
    setError(null);
    setOpen((o) => !o);
  };

  async function react(emoji: string) {
    const next = current === emoji ? null : emoji;
    const before = current;
    setCurrent(next);
    setOpen(false);
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, emoji: next }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "No se pudo reaccionar. Vuelve a intentarlo.");
      }
      router.refresh();
    } catch (e) {
      setCurrent(before);
      setError(e instanceof Error ? e.message : "No se pudo reaccionar. Vuelve a intentarlo.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={box} style={{ ...style, position: "relative", marginBottom: current ? 12 : 0 }}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Toca para reaccionar"
        onClick={(e) => {
          // A photo, a voice note or a document inside works as before.
          if ((e.target as Element).closest("a, button, audio, video, input")) return;
          toggle();
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
          e.preventDefault();
          toggle();
        }}
        style={{ cursor: "pointer", borderRadius: 12, outline: open ? "2px solid #f0b48f" : undefined }}
      >
        {children}
      </div>
      {current && (
        <span role="img" aria-label={`Tu reacción: ${current}`} title="Tu reacción" style={badgeStyle}>
          {current}
        </span>
      )}
      {open && (
        <div
          ref={bar}
          role="menu"
          aria-label="Reaccionar a este mensaje"
          style={{
            position: "absolute",
            left: 0,
            ...(below ? { top: "calc(100% + 6px)" } : { bottom: "calc(100% + 6px)" }),
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            gap: 2,
            maxWidth: 280,
            padding: blockedReason ? "8px 12px" : 4,
            borderRadius: blockedReason ? 12 : 999,
            background: "#fff",
            boxShadow: "0 6px 20px rgba(23, 24, 28, 0.18)",
          }}
        >
          {blockedReason ? (
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: "#5b5f6b" }}>{blockedReason}</span>
          ) : (
            STAFF_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="menuitemradio"
                aria-checked={current === emoji}
                aria-label={current === emoji ? `Quitar ${emoji}` : `Reaccionar con ${emoji}`}
                disabled={sending}
                onClick={() => react(emoji)}
                style={{
                  width: 44,
                  height: 44,
                  border: 0,
                  borderRadius: "50%",
                  background: current === emoji ? "#ece9e3" : "transparent",
                  fontSize: 24,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                {emoji}
              </button>
            ))
          )}
        </div>
      )}
      {error && (
        <div role="alert" style={{ maxWidth: 280, marginTop: current ? 16 : 4, fontSize: 12, lineHeight: 1.4, color: "#a3251f" }}>
          {error}
        </div>
      )}
    </div>
  );
}
