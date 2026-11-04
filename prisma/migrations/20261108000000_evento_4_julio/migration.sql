-- Manicuristas Imparables moves from Sunday 27 June to Sunday 4 July 2027 (the team, 2026-11-04: «tengo que pasar el
-- evento del 27 de junio al 4 de julio, adapta absolutamente todo»): the same day of the week and the same hours, a
-- week later.
--   1. Its words, wherever the team or a migration wrote them — the event's name and texts, its page (landingBlocks),
--      its sales page, its info pages, its versions, its ticket types, its broadcasts not sent yet and its
--      sequences' steps: the days around it move with it — 24–30 June → 1–7 July, and the month after (the
--      replay's 30 days) 26–31 July → 2–7 August, that one first so nothing moves twice — written out or as ISO days.
--   2. The moments tied to that week: a ticket type's or a version's opening or closing between 24 and 30 June
--      (Bogotá) — the full price closes as the congress starts —, seven days later.
--   3. The event itself: startsAt, endsAt and its days (scheduleDays), seven days later.
-- Only for an IMPARABLES event still on 27 June (Bogotá): the event is found by its old day in every step, and its
-- day moves last, so this runs once. The three helpers go away at the end.

CREATE OR REPLACE FUNCTION imp_mover_julio(t text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE
  pares text[][] := ARRAY[
    -- The month after the congress (its replay), first.
    ['26 de julio', '2 de agosto'], ['27 de julio', '3 de agosto'], ['28 de julio', '4 de agosto'],
    ['29 de julio', '5 de agosto'], ['30 de julio', '6 de agosto'], ['31 de julio', '7 de agosto'],
    ['2027-07-26', '2027-08-02'], ['2027-07-27', '2027-08-03'], ['2027-07-28', '2027-08-04'],
    ['2027-07-29', '2027-08-05'], ['2027-07-30', '2027-08-06'], ['2027-07-31', '2027-08-07'],
    -- Two days written together (from when it lasted two).
    ['27 y lunes 28 de junio', '4 y lunes 5 de julio'], ['27 y 28 de junio', '4 y 5 de julio'],
    ['27 & 28 de junio', '4 & 5 de julio'], ['27 & 28 Junio', '4 & 5 Julio'], ['27 & 28 junio', '4 & 5 julio'],
    -- The week of the congress.
    ['24 de junio', '1 de julio'], ['25 de junio', '2 de julio'], ['26 de junio', '3 de julio'],
    ['27 de junio', '4 de julio'], ['28 de junio', '5 de julio'], ['29 de junio', '6 de julio'],
    ['30 de junio', '7 de julio'], ['27 de Junio', '4 de Julio'], ['27 Junio', '4 Julio'], ['27 junio', '4 julio'],
    ['27/06/2027', '04/07/2027'], ['27/06', '04/07'],
    ['2027-06-24', '2027-07-01'], ['2027-06-25', '2027-07-02'], ['2027-06-26', '2027-07-03'],
    ['2027-06-27', '2027-07-04'], ['2027-06-28', '2027-07-05'], ['2027-06-29', '2027-07-06'],
    ['2027-06-30', '2027-07-07']
  ];
  i int;
BEGIN
  IF t IS NULL THEN
    RETURN NULL;
  END IF;
  FOR i IN 1 .. array_length(pares, 1) LOOP
    t := replace(t, pares[i][1], pares[i][2]);
  END LOOP;
  RETURN t;
END
$f$;

-- A moment in the week of the congress (24–30 June, Bogotá), a week later; any other, as it is.
CREATE OR REPLACE FUNCTION imp_mover_semana(m timestamp) RETURNS timestamp LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE WHEN m >= TIMESTAMP '2027-06-24 05:00:00' AND m < TIMESTAMP '2027-07-01 05:00:00' THEN m + INTERVAL '7 days' ELSE m END
$f$;

CREATE OR REPLACE FUNCTION imp_evento_27_junio() RETURNS SETOF text LANGUAGE sql STABLE AS $f$
  SELECT "id" FROM "Event"
  WHERE "theme" = 'IMPARABLES' AND "startsAt" >= TIMESTAMP '2027-06-27 05:00:00' AND "startsAt" < TIMESTAMP '2027-06-28 05:00:00'
$f$;

UPDATE "TicketType"
SET "name" = imp_mover_julio("name"),
    "description" = imp_mover_julio("description"),
    "stageNote" = imp_mover_julio("stageNote"),
    "hideUntil" = imp_mover_semana("hideUntil"),
    "hideAfter" = imp_mover_semana("hideAfter")
WHERE "eventId" IN (SELECT imp_evento_27_junio());

UPDATE "LandingVersion"
SET "title" = imp_mover_julio("title"),
    "subtitle" = imp_mover_julio("subtitle"),
    "priceLabel" = imp_mover_julio("priceLabel"),
    "specialPrices" = imp_mover_julio("specialPrices"::text)::jsonb,
    "startsAt" = imp_mover_semana("startsAt"),
    "endsAt" = imp_mover_semana("endsAt")
WHERE "eventId" IN (SELECT imp_evento_27_junio());

UPDATE "InfoPage"
SET "title" = imp_mover_julio("title"),
    "intro" = imp_mover_julio("intro"),
    "blocks" = imp_mover_julio("blocks"::text)::jsonb
WHERE "eventId" IN (SELECT imp_evento_27_junio());

UPDATE "EmailBroadcast"
SET "subject" = imp_mover_julio("subject"),
    "bodyText" = imp_mover_julio("bodyText"),
    "bodyHtml" = imp_mover_julio("bodyHtml")
WHERE "eventId" IN (SELECT imp_evento_27_junio()) AND "status" IN ('DRAFT', 'QUEUED');

UPDATE "WhatsAppBroadcast"
SET "variableMapping" = imp_mover_julio("variableMapping"::text)::jsonb
WHERE "eventId" IN (SELECT imp_evento_27_junio()) AND "status" IN ('DRAFT', 'QUEUED');

UPDATE "SequenceStep"
SET "subject" = imp_mover_julio("subject"),
    "bodyHtml" = imp_mover_julio("bodyHtml"),
    "buttonText" = imp_mover_julio("buttonText"),
    "variableMapping" = imp_mover_julio("variableMapping"::text)::jsonb
WHERE "sequenceId" IN (SELECT "id" FROM "Sequence" WHERE "eventId" IN (SELECT imp_evento_27_junio()));

-- Last, the event: its words, and its day a week later.
UPDATE "Event"
SET "name" = imp_mover_julio("name"),
    "publicName" = imp_mover_julio("publicName"),
    "subtitle" = imp_mover_julio("subtitle"),
    "description" = imp_mover_julio("description"),
    "virtualAccessInstructions" = imp_mover_julio("virtualAccessInstructions"),
    "ctaNote" = imp_mover_julio("ctaNote"),
    "closingText" = imp_mover_julio("closingText"),
    "registerButtonLabel" = imp_mover_julio("registerButtonLabel"),
    "confirmationEmailHtml" = imp_mover_julio("confirmationEmailHtml"),
    "confirmationEmailSubject" = imp_mover_julio("confirmationEmailSubject"),
    "shareText" = imp_mover_julio("shareText"),
    "confirmationTips" = ARRAY(SELECT imp_mover_julio(x) FROM unnest("confirmationTips") WITH ORDINALITY AS u(x, n) ORDER BY n),
    "salesPageContent" = imp_mover_julio("salesPageContent"::text)::jsonb,
    "landingBlocks" = imp_mover_julio("landingBlocks"::text)::jsonb,
    "scheduleDays" = imp_mover_julio("scheduleDays"::text)::jsonb,
    "startsAt" = "startsAt" + INTERVAL '7 days',
    "endsAt" = "endsAt" + INTERVAL '7 days'
WHERE "id" IN (SELECT imp_evento_27_junio());

DROP FUNCTION imp_evento_27_junio();
DROP FUNCTION imp_mover_semana(timestamp);
DROP FUNCTION imp_mover_julio(text);
