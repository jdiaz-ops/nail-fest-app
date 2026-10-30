"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// "Este precio termina en 30 días 14 horas 22 min 08 seg". Starts from the
// server's count so the first paint matches, then follows the clock; at
// zero the page asks the server again, which by then shows the next price
// (or the sale that just opened). `offsetMs` moves the clock for the team's
// preview of another day (?fecha=).

/** Seconds left until `to`, following the clock; at zero, the page asks the server again once. */
function useSecondsLeft(to: string, initialSeconds: number, offsetMs: number): number {
  const router = useRouter();
  const [left, setLeft] = useState(initialSeconds);
  const refreshed = useRef(false);

  useEffect(() => {
    const end = new Date(to).getTime();
    const tick = () => {
      const next = Math.max(0, Math.floor((end - Date.now() - offsetMs) / 1000));
      setLeft(next);
      if (next === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [to, router, offsetMs]);

  return left;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function ImpCountdown({
  to,
  label,
  initialSeconds,
  seconds = true,
  offsetMs = 0,
}: {
  to: string;
  label: string;
  initialSeconds: number;
  seconds?: boolean;
  offsetMs?: number;
}) {
  const left = useSecondsLeft(to, initialSeconds, offsetMs);
  const days = Math.floor(left / 86_400);
  const hours = Math.floor((left % 86_400) / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  const parts: [string, string][] = [
    [pad(days), days === 1 ? "día" : "días"],
    [pad(hours), hours === 1 ? "hora" : "horas"],
    [pad(minutes), "min"],
  ];
  if (seconds) parts.push([pad(left % 60), "seg"]);

  return (
    <div className="imp-count" role="timer" aria-label={`${label} ${days} días, ${hours} horas y ${minutes} minutos`}>
      <div className="imp-count-l">{label}</div>
      <div className="imp-count-row" aria-hidden="true">
        {parts.map(([n, unit]) => (
          <div className="imp-cbox" key={unit}>
            <b>{n}</b>
            <span>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The same count in one line, for the sticky bar (a version's special price, 2026-10-30): «12d 04:32:10». */
export function ImpCountdownInline({ to, initialSeconds, offsetMs = 0 }: { to: string; initialSeconds: number; offsetMs?: number }) {
  const left = useSecondsLeft(to, initialSeconds, offsetMs);
  const days = Math.floor(left / 86_400);
  const clock = `${pad(Math.floor((left % 86_400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return <span className="imp-clock-t">{days > 0 ? `${days}d ${clock}` : clock}</span>;
}
