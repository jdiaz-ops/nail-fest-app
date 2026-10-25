-- La Mesa (2026-10-25): the bank of pieces Claude proposes and the team
-- approves, and the day of edition 1. Nothing is sent from here.
CREATE TYPE "MesaSection" AS ENUM ('MITO', 'PALABRA', 'SABIAS', 'TRUCO', 'PORQUE', 'TERMOMETRO', 'ASUNTO');

CREATE TYPE "MesaPieceStatus" AS ENUM ('IDEA', 'APPROVED', 'DISCARDED');

CREATE TABLE "MesaPiece" (
    "id" TEXT NOT NULL,
    "section" "MesaSection" NOT NULL,
    "status" "MesaPieceStatus" NOT NULL DEFAULT 'IDEA',
    "content" JSONB NOT NULL,
    "topic" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "edition" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MesaPiece_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MesaSettings" (
    "id" TEXT NOT NULL,
    "firstEditionOn" DATE NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MesaSettings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MesaPiece_section_status_position_idx" ON "MesaPiece"("section", "status", "position");

CREATE INDEX "MesaPiece_edition_idx" ON "MesaPiece"("edition");
