-- Manicuristas Imparables as the team set it (2026-10-26): round prices
-- (Preventa $80.000, General $100.000, Última semana $120.000, as
-- lib/imparables/template.ts now creates them) and the congress's hours,
-- those of its program: 9:00 a. m. to 2:00 p. m., Bogotá, on 27 and 28
-- June 2027 — the event's span and its two days (Event.scheduleDays), so
-- the page, the emails and the ticket all say so.
UPDATE "TicketType" t
SET "price" = CASE lower(btrim(t."name")) WHEN lower('Preventa') THEN 80000 WHEN lower('General') THEN 100000 ELSE 120000 END,
    "updatedAt" = now()
FROM "Event" e
WHERE t."eventId" = e."id" AND e."theme" = 'IMPARABLES'
  AND lower(btrim(t."name")) IN (lower('Preventa'), lower('General'), lower('Última semana'));

UPDATE "Event"
SET "startsAt" = TIMESTAMP '2027-06-27 14:00:00',
    "endsAt" = TIMESTAMP '2027-06-28 19:00:00',
    "scheduleDays" = '[{"opensAt": "2027-06-27T14:00:00.000Z", "closesAt": "2027-06-27T19:00:00.000Z"}, {"opensAt": "2027-06-28T14:00:00.000Z", "closesAt": "2027-06-28T19:00:00.000Z"}]'::jsonb,
    "updatedAt" = now()
WHERE "theme" = 'IMPARABLES'
  AND ("slug" = 'manicuristas-imparables-2027' OR ("startsAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date = DATE '2027-06-27');
