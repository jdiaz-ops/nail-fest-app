"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveRoster,
  previewOutcome,
  bumpLocalCheckIn,
  rosterInfo,
  loadRoster,
  getQueue,
  enqueueScan,
  dequeueScans,
  queueLength,
  type LocalPreview,
} from "@/lib/offlineScan";

// Shared by every tab of the per-event scanner app (Escanear AND Lista —
// both need to submit a check-in and both need to know the same
// online/offline/roster/queue state) — see admin/scan/[eventId]/layout.tsx
// for how the event is picked. Extracted out of what used to be
// ScanClient.tsx's own internals so the two tabs don't duplicate (and
// drift apart on) this logic.

export type ApiResultKind = "VALID_FIRST" | "VALID_REENTRY" | "WRONG_EVENT" | "INVALID_TOKEN" | "NOT_FOUND";

interface ScanApiResult {
  result: ApiResultKind;
  personName?: string;
  eventName?: string;
  actualEventName?: string;
  previousScanAt?: string;
}

export type DisplayKind = ApiResultKind | "OFFLINE_UNKNOWN" | "REQUEST_ERROR";
export interface DisplayOutcome {
  kind: DisplayKind;
  offline: boolean;
  personName?: string;
  ticketTypeName?: string;
  eventName?: string;
  actualEventName?: string;
  previousScanAt?: string;
}

const LIVE_TIMEOUT_MS = 6000;
const SYNC_INTERVAL_MS = 20_000;
const ROSTER_REFRESH_INTERVAL_MS = 5 * 60_000;

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function previewToDisplay(preview: LocalPreview): DisplayOutcome {
  if (preview.kind === "unknown") return { kind: "OFFLINE_UNKNOWN", offline: true };
  return {
    kind: preview.kind === "valid_first" ? "VALID_FIRST" : "VALID_REENTRY",
    offline: true,
    personName: preview.personName,
    ticketTypeName: preview.ticketTypeName,
  };
}

export function useOfflineScanEngine(eventId: string, scannerLabel: string) {
  const [isOnline, setIsOnline] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [roster, setRoster] = useState<{ count: number; downloadedAt: string } | null>(null);
  const [downloadingRoster, setDownloadingRoster] = useState(false);
  // Bumped on every roster/queue mutation so components that read the raw
  // roster (Doorlist's list, not just previews) know to re-render.
  const [rosterVersion, setRosterVersion] = useState(0);

  const eventIdRef = useRef(eventId);
  const scannerLabelRef = useRef(scannerLabel);
  const syncingRef = useRef(false);
  eventIdRef.current = eventId;
  scannerLabelRef.current = scannerLabel;

  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    setPendingCount(queueLength());
  }, []);

  const downloadRoster = useCallback(async (id: string) => {
    if (!id) return;
    setDownloadingRoster(true);
    try {
      const res = await fetchWithTimeout(`/api/admin/scan/roster?eventId=${id}`, {}, LIVE_TIMEOUT_MS);
      if (!res.ok) return;
      const data = await res.json();
      saveRoster({ eventId: id, eventName: data.eventName, entries: data.entries });
      setRoster(rosterInfo(id));
      setRosterVersion((v) => v + 1);
      setIsOnline(true);
    } catch {
      // No connection right now — leave whatever's already cached alone.
    } finally {
      setDownloadingRoster(false);
    }
  }, []);

  useEffect(() => {
    if (!eventId) return;
    setRoster(rosterInfo(eventId));
    setRosterVersion((v) => v + 1);
    downloadRoster(eventId);
    const interval = setInterval(() => downloadRoster(eventId), ROSTER_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [eventId, downloadRoster]);

  const syncQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = getQueue();
    if (queue.length === 0) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const byEvent = new Map<string, typeof queue>();
      for (const item of queue) {
        const list = byEvent.get(item.eventId) ?? [];
        list.push(item);
        byEvent.set(item.eventId, list);
      }
      let anySuccess = false;
      for (const [evId, items] of byEvent) {
        for (let i = 0; i < items.length; i += 200) {
          const chunk = items.slice(i, i + 200);
          try {
            const res = await fetchWithTimeout(
              "/api/admin/scan/sync",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  eventId: evId,
                  scans: chunk.map((q) => ({
                    token: q.token,
                    scannerLabel: q.scannerLabel,
                    scannedAt: q.scannedAt,
                    clientScanId: q.clientScanId,
                  })),
                }),
              },
              LIVE_TIMEOUT_MS * 2
            );
            if (!res.ok) continue;
            const data: { results: { clientScanId: string; ok: boolean }[] } = await res.json();
            const confirmed = data.results.filter((r) => r.ok).map((r) => r.clientScanId);
            if (confirmed.length > 0) {
              dequeueScans(confirmed);
              anySuccess = true;
            }
          } catch {
            break;
          }
        }
      }
      setPendingCount(queueLength());
      setRosterVersion((v) => v + 1);
      if (anySuccess) {
        setIsOnline(true);
        setAuthError(false);
        if (eventIdRef.current) downloadRoster(eventIdRef.current);
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [downloadRoster]);

  useEffect(() => {
    syncQueue();
    const interval = setInterval(syncQueue, SYNC_INTERVAL_MS);
    window.addEventListener("online", syncQueue);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", syncQueue);
    };
  }, [syncQueue]);

  /** The one path every check-in goes through — camera decode, manual
   * paste, or a Doorlist tap. Always tries the server first; only falls
   * back to the local preview + queue when that attempt genuinely fails
   * (network error/timeout, or a 5xx suggesting the server itself is
   * having trouble) — never when it succeeds-but-rejects, since that's a
   * real answer, not a connectivity problem. Returns the outcome instead
   * of setting shared state, so each caller renders it its own way. */
  const submitToken = useCallback(async (token: string): Promise<DisplayOutcome> => {
    const currentEventId = eventIdRef.current;
    const label = scannerLabelRef.current || undefined;
    const clientScanId = crypto.randomUUID();
    const scannedAt = new Date().toISOString();

    try {
      const res = await fetchWithTimeout(
        "/api/admin/scan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, eventId: currentEventId, scannerLabel: label, scannedAt, clientScanId }),
        },
        LIVE_TIMEOUT_MS
      );

      if (res.ok) {
        const data: ScanApiResult = await res.json();
        setIsOnline(true);
        setAuthError(false);
        setRosterVersion((v) => v + 1);
        return { kind: data.result, offline: false, ...data };
      }

      if (res.status === 401 || res.status === 403) {
        setIsOnline(true);
        setAuthError(true);
        const preview = previewOutcome(currentEventId, token);
        bumpLocalCheckIn(currentEventId, token);
        enqueueScan({ clientScanId, eventId: currentEventId, token, scannerLabel: label, scannedAt });
        setPendingCount(queueLength());
        setRosterVersion((v) => v + 1);
        return previewToDisplay(preview);
      }

      if (res.status >= 500) {
        throw new Error(`server_error_${res.status}`);
      }

      console.error("scan request rejected", res.status, await res.text().catch(() => ""));
      return { kind: "REQUEST_ERROR", offline: false };
    } catch {
      setIsOnline(false);
      const preview = previewOutcome(currentEventId, token);
      bumpLocalCheckIn(currentEventId, token);
      enqueueScan({ clientScanId, eventId: currentEventId, token, scannerLabel: label, scannedAt });
      setPendingCount(queueLength());
      setRosterVersion((v) => v + 1);
      return previewToDisplay(preview);
    }
  }, []);

  /** For Doorlist — the current effective (server + any not-yet-synced
   * local) checked-in state of every downloaded registration, for one
   * event. Re-derives on every rosterVersion bump. */
  const rosterEntries = useCallback(() => {
    const r = loadRoster(eventId);
    if (!r) return [];
    return Object.entries(r.entries).map(([token, entry]) => ({
      token,
      personName: entry.personName,
      ticketTypeName: entry.ticketTypeName,
      checkedIn: entry.checkedInCount + entry.localCheckIns > 0,
    }));
  }, [eventId]);

  return {
    isOnline,
    authError,
    pendingCount,
    syncing,
    roster,
    downloadingRoster,
    downloadRoster,
    syncQueue,
    submitToken,
    rosterEntries,
    rosterVersion,
  };
}
