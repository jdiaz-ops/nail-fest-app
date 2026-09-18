-- CreateEnum
CREATE TYPE "ComprobanteMedio" AS ENUM ('TARJETA_2832', 'BOLD', 'EFECTIVO', 'REEMBOLSO', 'OTRO');

-- CreateEnum
CREATE TYPE "ComprobanteEstado" AS ENUM ('ENVIANDO', 'RECIBIDO', 'ENLAZADO', 'EN_REVISION', 'ERROR');

-- CreateTable
CREATE TABLE "Comprobante" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pendienteId" TEXT,
    "medio" "ComprobanteMedio" NOT NULL,
    "pagadoPor" TEXT NOT NULL,
    "nota" TEXT,
    "archivos" TEXT[],
    "estado" "ComprobanteEstado" NOT NULL DEFAULT 'ENVIANDO',
    "driveFileIds" TEXT[],
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "ultimoError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comprobante_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comprobante_userId_createdAt_idx" ON "Comprobante"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Comprobante" ADD CONSTRAINT "Comprobante_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
