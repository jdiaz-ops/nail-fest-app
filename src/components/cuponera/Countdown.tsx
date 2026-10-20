"use client";

import { useEffect, useState } from "react";

// "Termina en 08 : 42 : 15" for the deal of the day. Starts from the
// server's count so the first paint matches, then follows the clock.
export default function Countdown({ endsAt, initialSeconds }: { endsAt: string; initialSeconds: number }) {
  const [left, setLeft] = useState(initialSeconds);

  useEffect(() => {
    const end = new Date(endsAt).getTime();
    const tick = () => setLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const h = pad(Math.floor(left / 3600));
  const m = pad(Math.floor((left % 3600) / 60));
  const s = pad(left % 60);

  return (
    <div className="cup-countdown" role="timer" aria-label={`Termina en ${h} horas y ${m} minutos`}>
      <span className="cup-countdown-label">Termina en</span>
      <b>{h}</b>
      <span aria-hidden="true">:</span>
      <b>{m}</b>
      <span aria-hidden="true">:</span>
      <b>{s}</b>
    </div>
  );
}
