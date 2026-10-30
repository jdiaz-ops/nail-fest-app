-- Each email in its event's design chooses its modules (2026-10-30, the
-- team): her «Asistiré» card and «¿Vas con una colega?». On, as until now.
ALTER TABLE "EmailBroadcast" ADD COLUMN     "designAsistire" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designColega" BOOLEAN NOT NULL DEFAULT true;
