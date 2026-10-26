-- Manicuristas Imparables' price stages in plain words, as the team asked
-- (2026-10-26): «Preventa», «General» and «Última semana» become «Etapa 1»,
-- «Etapa 2» and «Etapa 3», and the regular price is added as it really is:
-- $150.000 to come in on the congress's two days, 27 and 28 June 2027 (from
-- Bogotá's midnight to 2:00 p. m. on the 28th, when it ends), so each stage
-- tells what it saves against it (lib/imparables/template.ts). Only events
-- on that calendar get it: the ones with a stage closing when the 27th
-- starts.
UPDATE "TicketType" t
SET "name" = CASE lower(btrim(t."name")) WHEN lower('Preventa') THEN 'Etapa 1' WHEN lower('General') THEN 'Etapa 2' ELSE 'Etapa 3' END,
    "updatedAt" = now()
FROM "Event" e
WHERE t."eventId" = e."id" AND e."theme" = 'IMPARABLES'
  AND lower(btrim(t."name")) IN (lower('Preventa'), lower('General'), lower('Última semana'));

INSERT INTO "TicketType" (
  "id", "eventId", "name", "quantity", "price", "bookingFee", "description", "status", "minPerOrder", "maxPerOrder",
  "issuance", "hideUntil", "hideAfter", "hideWhenSoldOut", "showRemainingOnPage", "order", "createdAt", "updatedAt"
)
SELECT
  'imp' || substr(md5(e."id" || ':Precio normal'), 1, 22),
  e."id", 'Precio normal', 3000, 150000, 0, NULL, 'ON_SALE', 1, 1,
  'INDIVIDUAL', TIMESTAMP '2027-06-27 05:00:00', TIMESTAMP '2027-06-28 19:00:00', false, false,
  COALESCE((SELECT max(t."order") FROM "TicketType" t WHERE t."eventId" = e."id"), -1) + 1,
  now(), now()
FROM "Event" e
WHERE e."theme" = 'IMPARABLES'
  AND EXISTS (SELECT 1 FROM "TicketType" t WHERE t."eventId" = e."id" AND t."hideAfter" = TIMESTAMP '2027-06-27 05:00:00')
  AND NOT EXISTS (SELECT 1 FROM "TicketType" t WHERE t."eventId" = e."id" AND lower(btrim(t."name")) = lower('Precio normal'));
