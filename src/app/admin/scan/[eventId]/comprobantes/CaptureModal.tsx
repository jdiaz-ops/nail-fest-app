"use client";

import { useRef, useState } from "react";
import type { ComprobanteMedio } from "@prisma/client";
import type { PendienteView } from "@/lib/comprobantes/types";
import { MEDIO_LABEL } from "@/lib/comprobantes/types";
import { compressImage } from "@/lib/imageCompression";
import { CameraIcon } from "../../icons";

const MAX_FILES = 5;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

const EMPRESA = "AUDAZ LAB S.A.S";
const NIT = "NIT 900.935.582-2";
const CORREO = "audazfacturas@gmail.com";

interface PickedFile {
  file: File;
  previewUrl: string | null; // null for a PDF — no visual thumbnail
}

type Step = "captura" | "recordatorio" | "formulario";

// The whole flow from "toca un pago pendiente / + Nuevo comprobante" to
// "enviado" — one modal, three steps (see Step above), matching the
// acceptance criterion of 1 toque a cámara + máximo 3 toques más a
// enviar. Submission itself is fire-and-forget (see onQueued/onDone):
// this modal closes the instant Enviar is tapped, the actual upload+send
// runs in the background reported through ComprobantesScreen's own
// queue, so a person can open this modal again immediately for the next
// receipt instead of waiting on a network round trip.
export default function CaptureModal({
  pendiente,
  currentUserName,
  onClose,
  onQueued,
  onQueueStatus,
  onDone,
}: {
  pendiente: PendienteView | null;
  currentUserName: string;
  onClose: () => void;
  onQueued: (localId: string) => void;
  onQueueStatus: (localId: string, status: "subiendo" | "enviando" | "error", error?: string) => void;
  onDone: (localId: string) => void;
}) {
  const [step, setStep] = useState<Step>("captura");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showCajero, setShowCajero] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [medio, setMedio] = useState<ComprobanteMedio>("TARJETA_2832");
  const [pagadoPor, setPagadoPor] = useState(currentUserName);
  const [nota, setNota] = useState("");

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);

  async function addFiles(picked: FileList | null) {
    if (!picked || picked.length === 0) return;
    setFileError(null);
    const room = MAX_FILES - files.length;
    if (room <= 0) {
      setFileError(`Máximo ${MAX_FILES} archivos por comprobante.`);
      return;
    }
    const toAdd = Array.from(picked).slice(0, room);
    setProcessing(true);
    try {
      const next: PickedFile[] = [];
      for (const raw of toAdd) {
        if (raw.type === "application/pdf") {
          if (raw.size > MAX_PDF_BYTES) {
            setFileError(`${raw.name} pesa más de 10MB.`);
            continue;
          }
          next.push({ file: raw, previewUrl: null });
        } else if (raw.type.startsWith("image/")) {
          const compressed = await compressImage(raw);
          next.push({ file: compressed, previewUrl: URL.createObjectURL(compressed) });
        }
      }
      setFiles((prev) => [...prev, ...next]);
    } finally {
      setProcessing(false);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const removed = prev[index];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function copy(label: string, value: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    });
  }

  async function submit() {
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    onQueued(localId);
    onClose();

    try {
      onQueueStatus(localId, "subiendo");
      const archivos: string[] = [];
      for (const { file } of files) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/comprobantes/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("upload_failed");
        const body = await res.json();
        archivos.push(body.url);
      }

      onQueueStatus(localId, "enviando");
      const res = await fetch("/api/comprobantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendienteId: pendiente?.id ?? null,
          medio,
          pagadoPor: pagadoPor.trim() || currentUserName,
          nota: nota.trim(),
          archivos,
        }),
      });
      if (!res.ok) throw new Error("create_failed");
      onDone(localId);
    } catch {
      onQueueStatus(localId, "error", "No se pudo enviar — vuelve a intentarlo desde Enviados recientemente.");
    }
  }

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, margin: 0 }}>
            {step === "captura" ? "Fotos del comprobante" : step === "recordatorio" ? "Antes de enviar" : "Detalles"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={closeButtonStyle}>
            ×
          </button>
        </div>

        {pendiente && (
          <div style={pendienteSummaryStyle}>
            <div style={{ fontWeight: 600 }}>{pendiente.descripcion}</div>
            <div style={{ color: "#8a8478", marginTop: 2 }}>
              {`$${pendiente.monto.toLocaleString("es-CO")}`} · {pendiente.cuenta}
            </div>
          </div>
        )}

        {step === "captura" && (
          <div>
            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ position: "relative" }}>
                    {f.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, never uploaded anywhere at this point
                      <img src={f.previewUrl} alt="" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 8, border: "1px solid #e3e1dc" }} />
                    ) : (
                      <div style={pdfChipStyle}>PDF</div>
                    )}
                    <button type="button" onClick={() => removeFile(i)} style={removeChipStyle} aria-label="Quitar">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {fileError && <p style={{ color: "#a3212b", fontSize: 12.5, margin: "0 0 10px" }}>{fileError}</p>}

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              disabled={processing || files.length >= MAX_FILES}
              style={cameraButtonStyle}
            >
              <CameraIcon /> {processing ? "Procesando…" : "Tomar foto"}
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={() => filesInputRef.current?.click()}
              disabled={processing || files.length >= MAX_FILES}
              style={secondaryButtonStyle}
            >
              Elegir de galería o archivos
            </button>
            <input
              ref={filesInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />

            <p style={{ fontSize: 11.5, color: "#8a8478", margin: "10px 0 0" }}>Hasta {MAX_FILES} archivos — fotos, o un PDF.</p>

            <button type="button" onClick={() => setStep("recordatorio")} disabled={files.length === 0} style={primaryButtonStyle}>
              Continuar
            </button>
          </div>
        )}

        {step === "recordatorio" && (
          <div>
            <div style={reminderCardStyle}>
              <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 10px" }}>¿Pediste factura electrónica a nombre de la empresa?</p>
              <CopyRow label="Empresa" value={EMPRESA} copied={copied === "Empresa"} onCopy={() => copy("Empresa", EMPRESA)} />
              <CopyRow label="NIT" value={NIT} copied={copied === "NIT"} onCopy={() => copy("NIT", NIT)} />
              <CopyRow label="Correo" value={CORREO} copied={copied === "Correo"} onCopy={() => copy("Correo", CORREO)} />
              <button type="button" onClick={() => setShowCajero(true)} style={secondaryButtonStyle}>
                Mostrar al cajero
              </button>
            </div>
            <button type="button" onClick={() => setStep("formulario")} style={primaryButtonStyle}>
              Continuar
            </button>
          </div>
        )}

        {step === "formulario" && (
          <div>
            <div className="field">
              <label style={fieldLabelStyle}>Medio de pago</label>
              <select value={medio} onChange={(e) => setMedio(e.target.value as ComprobanteMedio)} style={selectStyle}>
                {(Object.keys(MEDIO_LABEL) as ComprobanteMedio[]).map((m) => (
                  <option key={m} value={m}>
                    {MEDIO_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label style={fieldLabelStyle}>Pagado por</label>
              <input value={pagadoPor} onChange={(e) => setPagadoPor(e.target.value)} style={inputStyle} />
            </div>
            <div className="field">
              <label style={fieldLabelStyle}>Nota (opcional)</label>
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. almuerzo montaje Cali" style={inputStyle} />
            </div>

            <button type="button" onClick={submit} style={primaryButtonStyle}>
              Enviar
            </button>
          </div>
        )}
      </div>

      {showCajero && (
        <div style={cajeroOverlayStyle} onClick={() => setShowCajero(false)}>
          <div>
            <p style={cajeroLabelStyle}>Empresa</p>
            <p style={cajeroValueStyle}>{EMPRESA}</p>
            <p style={cajeroLabelStyle}>NIT</p>
            <p style={cajeroValueStyle}>{NIT}</p>
            <p style={cajeroLabelStyle}>Correo</p>
            <p style={cajeroValueStyle}>{CORREO}</p>
            <p style={{ textAlign: "center", color: "#8a8478", fontSize: 13, marginTop: 24 }}>Toca en cualquier parte para cerrar</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: "#8a8478", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      </div>
      <button type="button" onClick={onCopy} style={copyButtonStyle}>
        {copied ? "Copiado ✓" : "Copiar"}
      </button>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(20,20,28,0.5)",
  zIndex: 100,
  display: "flex",
  alignItems: "flex-end",
};

const sheetStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "16px 16px 0 0",
  padding: "20px 16px calc(20px + env(safe-area-inset-bottom))",
  width: "100%",
  maxHeight: "90dvh",
  overflowY: "auto",
};

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "none",
  fontSize: 22,
  lineHeight: 1,
  cursor: "pointer",
  color: "#5b5f6b",
  padding: 4,
};

const pendienteSummaryStyle: React.CSSProperties = {
  fontSize: 13,
  background: "#faf9f7",
  border: "1px solid #e3e1dc",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 14,
};

const cameraButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "14px",
  borderRadius: 10,
  border: "none",
  background: "#12966b",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  marginBottom: 10,
};

const secondaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 10,
  border: "1px solid #e3e1dc",
  background: "#fff",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 8,
};

const primaryButtonStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  borderRadius: 10,
  border: "none",
  background: "#12966b",
  color: "#fff",
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 18,
};

const reminderCardStyle: React.CSSProperties = {
  background: "#fff9f2",
  border: "1px dashed #e0a458",
  borderRadius: 10,
  padding: "14px",
};

const copyButtonStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid #e3e1dc",
  background: "#fff",
  cursor: "pointer",
  flexShrink: 0,
};

const pdfChipStyle: React.CSSProperties = {
  width: 76,
  height: 76,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
  border: "1px solid #e3e1dc",
  background: "#faf9f7",
  fontSize: 12,
  fontWeight: 700,
  color: "#5b5f6b",
};

const removeChipStyle: React.CSSProperties = {
  position: "absolute",
  top: -6,
  right: -6,
  border: "none",
  borderRadius: 999,
  width: 20,
  height: 20,
  background: "rgba(28,19,16,0.8)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 12,
  lineHeight: 1,
};

const fieldLabelStyle: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #e3e1dc", borderRadius: 8, fontSize: 14 };
const selectStyle: React.CSSProperties = { ...inputStyle };

// Pantalla completa, alto contraste, letra grande — "se lee bien a pleno
// sol" (criterio de aceptación): negro sobre blanco, no la paleta suave
// del resto de la app.
const cajeroOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "#fff",
  color: "#000",
  zIndex: 200,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
};
const cajeroLabelStyle: React.CSSProperties = { fontSize: 16, color: "#444", textAlign: "center", margin: "18px 0 4px" };
const cajeroValueStyle: React.CSSProperties = { fontSize: 32, fontWeight: 900, textAlign: "center", margin: 0 };
