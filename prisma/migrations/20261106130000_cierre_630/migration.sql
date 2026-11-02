-- Manicuristas Imparables (the team, 2026-11-02): Heidy's closing runs from 5:55 to 6:30 p. m., and the day ends at
-- 6:30 p. m. (Colombia): the afternoon's hours, what the page says of the day, and the event's end (the
-- confirmation, the ticket and the calendar say so).
UPDATE "Event"
SET "landingBlocks" = replace(replace(replace("landingBlocks"::text,
    '1:35 p. m. a 6:10 p. m.', '1:35 p. m. a 6:30 p. m.'),
    'de 8 a. m. a 6:10 p. m.', 'de 8 a. m. a 6:30 p. m.'),
    'de 8:00 a. m. a 6:10 p. m.', 'de 8:00 a. m. a 6:30 p. m.')::jsonb
WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
  AND "landingBlocks"::text LIKE '%6:10 p. m.%';

UPDATE "Event" SET "endsAt" = TIMESTAMP '2027-06-27 23:30:00'
WHERE theme = 'IMPARABLES' AND "endsAt" = TIMESTAMP '2027-06-27 23:10:00';

UPDATE "Event"
SET "scheduleDays" = jsonb_build_array(jsonb_set("scheduleDays"->0, '{closesAt}', '"2027-06-27T23:30:00.000Z"'::jsonb))
WHERE theme = 'IMPARABLES' AND jsonb_typeof("scheduleDays") = 'array' AND jsonb_array_length("scheduleDays") = 1
  AND "scheduleDays"->0->>'closesAt' = '2027-06-27T23:10:00.000Z';
