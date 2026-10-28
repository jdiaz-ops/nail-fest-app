-- Manicuristas Imparables (the team, 2026-10-28): the cover's button says
-- «Reservar mi cupo». Only where it still reads as the previous version left it.
UPDATE "Event" SET "registerButtonLabel" = 'Reservar mi cupo' WHERE "theme" = 'IMPARABLES' AND "registerButtonLabel" = 'Quiero hacerlo diferente';
