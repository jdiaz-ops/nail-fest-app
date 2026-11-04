-- Each La Mesa edition's blocks: their order and whether Manicuristas Imparables' banner goes in it (2026-11-04).
CREATE TABLE "MesaEditionLayout" (
    "edition" INTEGER NOT NULL,
    "blocks" TEXT[],
    "imparables" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MesaEditionLayout_pkey" PRIMARY KEY ("edition")
);
