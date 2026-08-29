"use client";

import type { DisplayKind } from "@/lib/useOfflineScanEngine";

// Synthesized (not audio files) — nothing to host, nothing that can fail
// to load mid-event. Three deliberately distinct signatures so staff can
// tell them apart WITHOUT looking at the screen, by ear alone, while
// they're already looking at the next person in line:
//
//   - Éxito (VALID_FIRST): a bright two-note rising chime ("ting") —
//     the one sound that should feel like unambiguous good news.
//   - Reingreso / advertencia (VALID_REENTRY, WRONG_EVENT,
//     OFFLINE_UNKNOWN): a single warm, neutral double-bip — noticeably
//     different in pitch and rhythm from success, but not alarming
//     (WRONG_EVENT/OFFLINE_UNKNOWN aren't confirmed rejections either,
//     see ScannerTab's own comment on why those stay amber, not red).
//   - Error (INVALID_TOKEN, NOT_FOUND, REQUEST_ERROR): a low buzzy
//     double-beep — the "something's wrong" sound, short so it doesn't
//     grate in a room full of people.

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Call on the first real user gesture (a tap anywhere) — most mobile
 * browsers won't produce sound from an AudioContext until one has
 * happened. Safe/cheap to call repeatedly; a no-op once already running. */
export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

interface Note {
  freq: number;
  at: number; // seconds from now
  duration: number; // seconds
  type?: OscillatorType;
  gain?: number;
}

function playNotes(notes: Note[]) {
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const now = c.currentTime;
  for (const note of notes) {
    const osc = c.createOscillator();
    const gainNode = c.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;
    const start = now + note.at;
    const end = start + note.duration;
    const peak = note.gain ?? 0.2;
    // Quick attack, exponential-ish decay — a real chime/beep envelope
    // instead of an abrupt on/off click.
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(peak, start + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gainNode);
    gainNode.connect(c.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

export function playSuccessSound() {
  playNotes([
    { freq: 1046.5, at: 0, duration: 0.12, gain: 0.18 }, // C6
    { freq: 1568, at: 0.09, duration: 0.22, gain: 0.2 }, // G6 — the "ting"
  ]);
}

export function playReentrySound() {
  playNotes([
    { freq: 660, at: 0, duration: 0.11, type: "triangle", gain: 0.16 },
    { freq: 660, at: 0.15, duration: 0.14, type: "triangle", gain: 0.16 },
  ]);
}

export function playErrorSound() {
  playNotes([
    { freq: 220, at: 0, duration: 0.13, type: "square", gain: 0.1 },
    { freq: 196, at: 0.16, duration: 0.16, type: "square", gain: 0.1 },
  ]);
}

// Shared by ScannerTab (camera + manual entry) and DoorlistTab (manual
// search-and-tap check-in) — same three-way grouping either way, since
// both paths resolve through the exact same submitToken().
export function playSoundForResult(kind: DisplayKind) {
  if (kind === "VALID_FIRST") return playSuccessSound();
  if (kind === "VALID_REENTRY" || kind === "WRONG_EVENT" || kind === "OFFLINE_UNKNOWN") return playReentrySound();
  return playErrorSound(); // INVALID_TOKEN, NOT_FOUND, REQUEST_ERROR
}
