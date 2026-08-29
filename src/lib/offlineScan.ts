// Everything the scanner PWA needs to keep working with no connection —
// the roster downloaded ahead of time, the queue of scans that happened
// offline, and a rough local preview of VALID_FIRST vs VALID_REENTRY
// while offline. This is deliberately NOT the source of truth: the real
// ScanLog only ever gets written server-side (see lib/scan.ts), once each
// queued scan syncs. Everything here is either "what to show someone at
// the door right now" or "what to send once there's a connection again".
//
// Plain functions, no React — useOfflineScanEngine.ts owns the state/
// reactivity, this owns localStorage. Every function no-ops safely if window/
// localStorage isn't available (SSR, or a browser blocking storage),
// since a scan attempt must never crash just because it couldn't cache.

const ROSTER_PREFIX = "nf_scan_roster_v1_";
const QUEUE_KEY = "nf_scan_queue_v1";

export interface RosterEntry {
  personName?: string;
  ticketTypeName?: string;
  ticketCount: number;
  checkedInCount: number;
  // Bumped locally as offline scans of this token happen this session —
  // never sent to the server, purely so a SECOND offline scan of the same
  // ticket previews as "reingreso" instead of "válida" again. Reset to 0
  // every time a fresh roster download overwrites this entry.
  localCheckIns: number;
}

export interface Roster {
  eventId: string;
  eventName: string;
  downloadedAt: string; // ISO
  entries: Record<string, RosterEntry>; // keyed by QR token
}

export interface QueuedScan {
  clientScanId: string;
  eventId: string;
  token: string;
  scannerLabel?: string;
  scannedAt: string; // ISO — the phone's own clock at the moment of the real scan
  attempts: number;
}

function hasStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    // Some browsers throw just accessing localStorage in certain privacy
    // modes — treat exactly like "not available".
    return false;
  }
}

function readJson<T>(key: string): T | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // corrupted entry — treat as absent rather than throwing
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Quota exceeded, or storage blocked mid-session — the caller decides
    // what a failed save means (e.g. don't claim the roster downloaded).
    return false;
  }
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export function saveRoster(input: {
  eventId: string;
  eventName: string;
  entries: { token: string; personName?: string; ticketTypeName?: string; ticketCount: number; checkedInCount: number }[];
}): boolean {
  const entries: Record<string, RosterEntry> = {};
  for (const e of input.entries) {
    entries[e.token] = {
      personName: e.personName,
      ticketTypeName: e.ticketTypeName,
      ticketCount: e.ticketCount,
      checkedInCount: e.checkedInCount,
      localCheckIns: 0,
    };
  }
  const roster: Roster = { eventId: input.eventId, eventName: input.eventName, downloadedAt: new Date().toISOString(), entries };
  return writeJson(ROSTER_PREFIX + input.eventId, roster);
}

export function loadRoster(eventId: string): Roster | null {
  return readJson<Roster>(ROSTER_PREFIX + eventId);
}

export type LocalPreview =
  | { kind: "valid_first"; personName?: string; ticketTypeName?: string }
  | { kind: "valid_reentry"; personName?: string; ticketTypeName?: string }
  | { kind: "unknown" }; // not in the downloaded roster — could be genuinely invalid, or just a registration newer than the last download; NEVER presented as a confident rejection, see ScannerTab.tsx and DoorlistTab.tsx

/** Read-only preview — does NOT mutate localCheckIns. Call bumpLocalCheckIn
 * separately, once the scan is actually being queued (not on every decode
 * of the same still-in-frame QR). */
export function previewOutcome(eventId: string, token: string): LocalPreview {
  const roster = loadRoster(eventId);
  const entry = roster?.entries[token];
  if (!entry) return { kind: "unknown" };
  const effectiveCheckIns = entry.checkedInCount + entry.localCheckIns;
  return effectiveCheckIns > 0
    ? { kind: "valid_reentry", personName: entry.personName, ticketTypeName: entry.ticketTypeName }
    : { kind: "valid_first", personName: entry.personName, ticketTypeName: entry.ticketTypeName };
}

export function bumpLocalCheckIn(eventId: string, token: string): void {
  const roster = loadRoster(eventId);
  const entry = roster?.entries[token];
  if (!roster || !entry) return;
  entry.localCheckIns += 1;
  writeJson(ROSTER_PREFIX + eventId, roster);
}

export function rosterInfo(eventId: string): { count: number; downloadedAt: string } | null {
  const roster = loadRoster(eventId);
  if (!roster) return null;
  return { count: Object.keys(roster.entries).length, downloadedAt: roster.downloadedAt };
}

// ---------------------------------------------------------------------------
// Offline queue — scans that happened without a server round trip
// succeeding, waiting to be replayed via POST /api/admin/scan/sync.
// ---------------------------------------------------------------------------

export function getQueue(): QueuedScan[] {
  return readJson<QueuedScan[]>(QUEUE_KEY) ?? [];
}

export function queueLength(): number {
  return getQueue().length;
}

export function enqueueScan(scan: Omit<QueuedScan, "attempts">): boolean {
  const queue = getQueue();
  // Same clientScanId already queued (a decode fired twice before the
  // first attempt finished) — don't duplicate it.
  if (queue.some((q) => q.clientScanId === scan.clientScanId)) return true;
  queue.push({ ...scan, attempts: 0 });
  return writeJson(QUEUE_KEY, queue);
}

/** Removes only the given clientScanIds (the ones the server actually
 * confirmed) — anything else stays queued for the next sync attempt. */
export function dequeueScans(clientScanIds: string[]): void {
  const toRemove = new Set(clientScanIds);
  const remaining = getQueue().filter((q) => !toRemove.has(q.clientScanId));
  writeJson(QUEUE_KEY, remaining);
}

export function markQueueAttempt(clientScanIds: string[]): void {
  const attempted = new Set(clientScanIds);
  const queue = getQueue().map((q) => (attempted.has(q.clientScanId) ? { ...q, attempts: q.attempts + 1 } : q));
  writeJson(QUEUE_KEY, queue);
}
