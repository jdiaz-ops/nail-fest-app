"use client";

import { useEffect, useState } from "react";

// The program is in Colombia's hours; a visitor somewhere else (Chile,
// Spain, Mexico…) also sees her own under each one. Only known in the
// browser, after the first paint, so the server's page is Colombia's alone.

function clock(date: Date): string {
  const hour = date.getHours();
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(date.getMinutes()).padStart(2, "0")} ${hour < 12 ? "a. m." : "p. m."}`;
}

/** Her own hour for this line, when her clock isn't the event's (`eventOffset`: minutes east of UTC there). */
export default function ImpLocalTime({ instant, eventOffset }: { instant: string; eventOffset: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const date = new Date(instant);
    if (-date.getTimezoneOffset() !== eventOffset) setText(clock(date));
  }, [instant, eventOffset]);
  return text ? <em className="imp-ag-local">{text}</em> : null;
}

/** On the cover, under Colombia's hours: the congress's hours where she is, when her clock isn't the event's. */
export function ImpYourHours({ opensAt, closesAt, eventOffset }: { opensAt: string; closesAt: string; eventOffset: number }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    const opens = new Date(opensAt);
    if (-opens.getTimezoneOffset() !== eventOffset) setText(`Donde estás tú: ${clock(opens)} a ${clock(new Date(closesAt))}`);
  }, [opensAt, closesAt, eventOffset]);
  return text ? <span className="imp-when-local">{text}</span> : null;
}

/** The line under the program, which says whose hours those are. */
export function ImpZoneNote({ zone, eventOffset, at }: { zone: string; eventOffset: number; at: string }) {
  const [elsewhere, setElsewhere] = useState(false);
  useEffect(() => {
    setElsewhere(-new Date(at).getTimezoneOffset() !== eventOffset);
  }, [at, eventOffset]);
  const hours = zone ? `Horas de ${zone.replace(/^hora /, "")}.` : "Horas del evento.";
  return <p className="imp-tz">{elsewhere ? `${hours} Debajo de cada una, más clara, la hora donde estás tú.` : `${hours} ¿Estás en otro país? Te mostramos la hora de tu ciudad.`}</p>;
}
