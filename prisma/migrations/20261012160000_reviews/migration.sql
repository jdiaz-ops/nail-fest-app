-- Reseñas (see schema comments): one per registration, moderated, with photos and a per-event sorteo.
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');
CREATE TYPE "ReviewRaffleWinnerKind" AS ENUM ('WINNER', 'BACKUP');

ALTER TABLE "Event" ADD COLUMN "reviewSummary" JSONB;
ALTER TABLE "Event" ADD COLUMN "reviewSummaryAt" TIMESTAMP(3);
ALTER TABLE "EmailBroadcast" ADD COLUMN "onlyCheckedIn" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "instagramHandle" TEXT,
    "publishConsent" BOOLEAN NOT NULL DEFAULT false,
    "publishConsentAt" TIMESTAMP(3),
    "raffleOptIn" BOOLEAN NOT NULL DEFAULT false,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "moderatedAt" TIMESTAMP(3),
    "moderatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Review_registrationId_key" ON "Review"("registrationId");
CREATE INDEX "Review_eventId_status_featured_idx" ON "Review"("eventId", "status", "featured");
CREATE INDEX "Review_personId_idx" ON "Review"("personId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "Registration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReviewPhoto" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReviewPhoto_reviewId_idx" ON "ReviewPhoto"("reviewId");
ALTER TABLE "ReviewPhoto" ADD CONSTRAINT "ReviewPhoto_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReviewRaffle" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "prizeCount" INTEGER NOT NULL DEFAULT 3,
    "prizeLabel" TEXT NOT NULL DEFAULT 'kit de marcas',
    "closesAt" TIMESTAMP(3) NOT NULL,
    "drawnAt" TIMESTAMP(3),
    "participants" INTEGER,
    "seed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReviewRaffle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReviewRaffle_eventId_key" ON "ReviewRaffle"("eventId");
ALTER TABLE "ReviewRaffle" ADD CONSTRAINT "ReviewRaffle_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ReviewRaffleWinner" (
    "id" TEXT NOT NULL,
    "raffleId" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "ReviewRaffleWinnerKind" NOT NULL,
    CONSTRAINT "ReviewRaffleWinner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReviewRaffleWinner_raffleId_reviewId_key" ON "ReviewRaffleWinner"("raffleId", "reviewId");
ALTER TABLE "ReviewRaffleWinner" ADD CONSTRAINT "ReviewRaffleWinner_raffleId_fkey" FOREIGN KEY ("raffleId") REFERENCES "ReviewRaffle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewRaffleWinner" ADD CONSTRAINT "ReviewRaffleWinner_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
