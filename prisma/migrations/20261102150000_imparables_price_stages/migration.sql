-- Manicuristas Imparables' three price stages, set up for the team
-- (2026-10-26): an event made from the template that already had a ticket
-- type never got them (the template only creates them on an event with
-- none), so its page sold a test ticket. Each stage is created where the
-- event has none by that name, as «Usar la plantilla» does
-- (lib/imparables/template.ts: its price, Bogotá-midnight dates, 3000
-- tickets, one per person), and the test ticket («Prueba…») is hidden, not
-- deleted: its status in Entradas brings it back.
WITH stage ("name", "price", "opensAt", "closesAt", "n") AS (
  VALUES
    ('Preventa', 79900, NULL::timestamp(3), TIMESTAMP '2027-04-01 05:00:00', 1),
    ('General', 99900, TIMESTAMP '2027-04-01 05:00:00', TIMESTAMP '2027-06-21 05:00:00', 2),
    ('Última semana', 119900, TIMESTAMP '2027-06-21 05:00:00', TIMESTAMP '2027-06-27 05:00:00', 3)
)
INSERT INTO "TicketType" (
  "id", "eventId", "name", "quantity", "price", "bookingFee", "description", "status", "minPerOrder", "maxPerOrder",
  "issuance", "hideUntil", "hideAfter", "hideWhenSoldOut", "showRemainingOnPage", "order", "createdAt", "updatedAt"
)
SELECT
  'imp' || substr(md5(e."id" || ':' || s."name"), 1, 22),
  e."id", s."name", 3000, s."price", 0, NULL, 'ON_SALE', 1, 1,
  'INDIVIDUAL', s."opensAt", s."closesAt", false, false,
  COALESCE((SELECT max(t."order") FROM "TicketType" t WHERE t."eventId" = e."id"), -1) + s."n",
  now(), now()
FROM "Event" e
CROSS JOIN stage s
WHERE e."theme" = 'IMPARABLES'
  AND NOT EXISTS (SELECT 1 FROM "TicketType" t WHERE t."eventId" = e."id" AND lower(btrim(t."name")) = lower(s."name"));

UPDATE "TicketType" t
SET "status" = 'HIDDEN', "updatedAt" = now()
FROM "Event" e
WHERE t."eventId" = e."id" AND e."theme" = 'IMPARABLES' AND t."status" = 'ON_SALE' AND t."name" ILIKE '%prueba%';
