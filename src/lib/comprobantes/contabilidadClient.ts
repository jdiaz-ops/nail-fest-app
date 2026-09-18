import { unstable_cache } from "next/cache";
import { mockPendientes, mockSubir } from "./mock";
import type { PendientesResponse, SubirPayload, SubirResult } from "./types";

// The one place that talks to the backend contable (a Google Apps Script
// Web App) — see prisma/schema.prisma's Comprobante model comment and
// docs/COMPROBANTES.md for the full contract. Every call is server-side
// only: CONTABILIDAD_API_URL/CONTABILIDAD_API_TOKEN never reach the
// client (see the API routes under /api/comprobantes/*, the only things
// allowed to import this module).
const TIMEOUT_MS = 30_000;

function isMock(): boolean {
  return process.env.COMPROBANTES_MOCK === "1";
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // redirect: "follow" — Apps Script Web Apps answer with a 302 to
    // script.googleusercontent.com before the real response; the default
    // fetch behavior already follows that, this is just making the
    // requirement explicit and not silently dependent on a default.
    return await fetch(url, { ...init, redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function requireConfig(): { url: string; token: string } | null {
  const url = process.env.CONTABILIDAD_API_URL;
  const token = process.env.CONTABILIDAD_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function fetchPendientesLive(): Promise<PendientesResponse> {
  const config = requireConfig();
  if (!config) {
    // Neither mock nor real config — an empty, well-shaped response
    // rather than throwing, so the screen still renders (just always
    // empty) instead of a hard error while COMPROBANTES_MOCK/the real
    // credentials are still being set up.
    return { ok: true, actualizado: new Date().toISOString(), pendientes: [], recientes: [] };
  }
  const res = await fetchWithTimeout(`${config.url}?accion=pendientes&token=${encodeURIComponent(config.token)}`, {
    method: "GET",
  });
  const body = await res.json();
  if (!body?.ok) throw new Error("pendientes: backend respondió ok:false");
  return body as PendientesResponse;
}

// 60s server-side cache (see the endpoint's own schema comment) — a
// shared Next.js data-cache entry, not per-request, so every admin
// polling "Pagos sin soporte" at once still only hits the Apps Script Web
// App (slow, rate-sensitive) once a minute.
const cachedFetchPendientesLive = unstable_cache(fetchPendientesLive, ["comprobantes-pendientes"], { revalidate: 60 });

export async function getPendientes(): Promise<PendientesResponse> {
  return isMock() ? mockPendientes() : cachedFetchPendientesLive();
}

export async function subirComprobante(payload: SubirPayload): Promise<SubirResult> {
  if (isMock()) return mockSubir(payload);
  const config = requireConfig();
  if (!config) return { ok: false, error: "backend_no_configurado" };

  // Apps Script doesn't read headers for auth — the token goes in the
  // body, per the contract.
  const res = await fetchWithTimeout(config.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion: "subir", token: config.token, ...payload }),
  });
  const body = await res.json();
  return body as SubirResult;
}
