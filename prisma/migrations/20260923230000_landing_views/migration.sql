-- CreateTable
CREATE TABLE "LandingView" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LandingView_eventId_country_idx" ON "LandingView"("eventId", "country");

-- AddForeignKey
ALTER TABLE "LandingView" ADD CONSTRAINT "LandingView_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
