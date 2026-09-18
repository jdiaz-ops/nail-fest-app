import type { ComprobanteMedio, ComprobanteEstado } from "@prisma/client";

// Shape of the backend contable's (Google Apps Script) two endpoints —
// see contabilidadClient.ts for the actual calls, mock.ts for the
// COMPROBANTES_MOCK=1 stand-in used while that backend doesn't exist yet.

export interface PendienteView {
  id: string;
  fecha: string; // "2026-09-12"
  monto: number; // COP, whole pesos
  descripcion: string;
  cuenta: string; // "Bancolombia" | "Bold" | ...
  dias: number;
}

// estado here is only the three the backend itself reports — ERROR/
// ENVIANDO are purely local (this app's own send attempt never got
// through to the backend at all, so the backend has nothing to say about
// it yet).
export type RecienteEstado = "recibido" | "enlazado" | "en_revision";

export interface RecienteView {
  comprobanteId: string;
  estado: RecienteEstado;
  movimiento: string; // "12-sep · $85.000 · COMPRA EN RESTAURANTE X"
}

export interface PendientesResponse {
  ok: true;
  actualizado: string; // ISO
  pendientes: PendienteView[];
  recientes: RecienteView[];
}

export interface ArchivoAdjunto {
  nombre: string;
  mime: string;
  base64: string;
}

export interface SubirPayload {
  comprobanteId: string;
  pendienteId: string | null;
  empresa: string;
  medio: string; // wire value — see MEDIO_WIRE below
  pagadoPor: string;
  usuarioEmail: string;
  nota: string;
  fechaCaptura: string; // ISO with offset
  archivos: ArchivoAdjunto[];
}

export type SubirResult =
  | { ok: true; estado: "recibido"; driveFileIds: string[] }
  | { ok: false; error: string };

// This app's ComprobanteMedio enum values vs. the exact strings the
// backend contract expects on the wire (medio: "tarjeta_2832" | "bold" |
// "efectivo" | "reembolso" | "otro") — kept as an explicit map rather
// than lowercasing the enum name so the two are never silently assumed
// to match if either side's naming ever drifts.
export const MEDIO_WIRE: Record<ComprobanteMedio, string> = {
  TARJETA_2832: "tarjeta_2832",
  BOLD: "bold",
  EFECTIVO: "efectivo",
  REEMBOLSO: "reembolso",
  OTRO: "otro",
};

export const MEDIO_LABEL: Record<ComprobanteMedio, string> = {
  TARJETA_2832: "Tarjeta Bancolombia *2832",
  BOLD: "Bold",
  EFECTIVO: "Efectivo",
  REEMBOLSO: "Pagué de mi bolsillo (reembolso)",
  OTRO: "Otro",
};

// backend recientes.estado -> this app's own ComprobanteEstado, for the
// reconciliation pass in the pendientes route.
export const RECIENTE_TO_ESTADO: Record<RecienteEstado, ComprobanteEstado> = {
  recibido: "RECIBIDO",
  enlazado: "ENLAZADO",
  en_revision: "EN_REVISION",
};
