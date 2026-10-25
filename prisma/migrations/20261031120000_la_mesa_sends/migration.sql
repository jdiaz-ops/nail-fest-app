-- La Mesa sends (2026-10-25): an EmailBroadcast can be an edition of La Mesa
-- (mesaEdition, and the frozen edition in mesaContent once it starts going
-- out), and the answers tapped in its email are kept per person (MesaVote).
-- Nothing is scheduled or sent by this migration.

-- AlterTable
ALTER TABLE "EmailBroadcast" ADD COLUMN     "mesaContent" JSONB,
ADD COLUMN     "mesaEdition" INTEGER;

-- CreateTable
CREATE TABLE "MesaVote" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "edition" INTEGER NOT NULL,
    "option" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MesaVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MesaVote_edition_idx" ON "MesaVote"("edition");

-- CreateIndex
CREATE INDEX "MesaVote_personId_idx" ON "MesaVote"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "MesaVote_pieceId_personId_key" ON "MesaVote"("pieceId", "personId");

-- CreateIndex
CREATE INDEX "EmailBroadcast_mesaEdition_idx" ON "EmailBroadcast"("mesaEdition");

-- AddForeignKey
ALTER TABLE "MesaVote" ADD CONSTRAINT "MesaVote_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "MesaPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MesaVote" ADD CONSTRAINT "MesaVote_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

