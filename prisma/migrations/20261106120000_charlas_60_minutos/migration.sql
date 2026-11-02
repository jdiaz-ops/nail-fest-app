-- Manicuristas Imparables (the team, 2026-11-02): an hour for every speaker. The program, from 8:00 a. m. to
-- 6:10 p. m.: Heidy's welcome (15 minutes), Cristina Sierra, Jimena Montalban, a break, Paula Chacón, a break,
-- Alejandro Salinas and lunch (12:35 to 1:35); then Karen Pinzón, a break, Fabi Pinillo Martínez, a break, Juan
-- Tenorio, Oskar Garzón and Heidy's closing (15 minutes). Every line keeps all of its own (talk, photo, Instagram,
-- note; each break its theme, guide and sponsor, in the order they had): only its hour and its place change. A
-- program that doesn't hold exactly these lines is left as it is.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
ag AS (
  SELECT DISTINCT ON (id) id, i, b FROM el
  WHERE b->>'type' = 'agenda' AND jsonb_typeof(b->'rows') = 'array'
  ORDER BY id, i
),
r AS (
  SELECT ag.id, x.value AS row, x.ordinality AS j,
    CASE
      WHEN x.value->>'kind' = 'day' AND x.value->>'chip' ILIKE 'Mañana%' THEN 'manana'
      WHEN x.value->>'kind' = 'day' AND x.value->>'chip' ILIKE 'Tarde%' THEN 'tarde'
      WHEN x.value->>'instructor' ILIKE 'Cristina%' THEN 'cristina'
      WHEN x.value->>'instructor' ILIKE 'Jimena%' THEN 'jimena'
      WHEN x.value->>'instructor' ILIKE 'Paula%' THEN 'paula'
      WHEN x.value->>'instructor' ILIKE 'Alejandro%' THEN 'salinas'
      WHEN x.value->>'instructor' ILIKE 'Karen%' THEN 'karen'
      WHEN x.value->>'instructor' ILIKE 'Fabi%' THEN 'fabi'
      WHEN x.value->>'instructor' ILIKE 'Juan Tenorio%' THEN 'juan'
      WHEN x.value->>'instructor' ILIKE 'Oskar%' THEN 'oskar'
      WHEN coalesce(x.value->>'topic', '') ILIKE 'Pausa%' THEN 'pausa'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE 'Bienvenida%' THEN 'bienvenida'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE '%almuerzo%' THEN 'almuerzo'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE 'Cierre%' THEN 'cierre'
    END AS k
  FROM ag CROSS JOIN LATERAL jsonb_array_elements(ag.b->'rows') WITH ORDINALITY AS x(value, ordinality)
),
rn AS (
  SELECT r.*, row_number() OVER (PARTITION BY r.id, r.k ORDER BY r.j) AS n FROM r
),
ok AS (
  SELECT id FROM rn GROUP BY id
  HAVING count(*) = 17
     AND count(*) FILTER (WHERE k IS NULL) = 0
     AND count(*) FILTER (WHERE k = 'pausa') = 4
     AND count(DISTINCT k) FILTER (WHERE k <> 'pausa') = 13
     AND count(*) FILTER (WHERE k <> 'pausa') = 13
),
plan(ord, k, n, chip, extra) AS (
  VALUES
    (1, 'manana', 1, NULL, '{"text": "8:00 a. m. a 12:35 p. m."}'::jsonb),
    (2, 'bienvenida', 1, '8:00 a. m.', '{}'::jsonb),
    (3, 'cristina', 1, '8:15 a. m.', '{}'::jsonb),
    (4, 'jimena', 1, '9:15 a. m.', '{}'::jsonb),
    (5, 'pausa', 1, '10:15 a. m.', '{}'::jsonb),
    (6, 'paula', 1, '10:25 a. m.', '{}'::jsonb),
    (7, 'pausa', 2, '11:25 a. m.', '{}'::jsonb),
    (8, 'salinas', 1, '11:35 a. m.', '{}'::jsonb),
    (9, 'almuerzo', 1, '12:35 p. m.', '{"text": "De 12:35 a 1:35 p. m."}'::jsonb),
    (10, 'tarde', 1, NULL, '{"text": "1:35 p. m. a 6:10 p. m."}'::jsonb),
    (11, 'karen', 1, '1:35 p. m.', '{}'::jsonb),
    (12, 'pausa', 3, '2:35 p. m.', '{}'::jsonb),
    (13, 'fabi', 1, '2:45 p. m.', '{}'::jsonb),
    (14, 'pausa', 4, '3:45 p. m.', '{}'::jsonb),
    (15, 'juan', 1, '3:55 p. m.', '{}'::jsonb),
    (16, 'oskar', 1, '4:55 p. m.', '{}'::jsonb),
    (17, 'cierre', 1, '5:55 p. m.', '{}'::jsonb)
),
rows_new AS (
  SELECT ok.id,
    (SELECT jsonb_agg(
        rn.row || CASE WHEN p.chip IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('chip', p.chip) END || p.extra
        ORDER BY p.ord)
     FROM plan p JOIN rn ON rn.id = ok.id AND rn.k = p.k AND rn.n = p.n) AS rows
  FROM ok
),
changed AS (
  SELECT el.id, el.i,
    CASE WHEN el.i = ag.i THEN jsonb_set(el.b, '{rows}', rows_new.rows) ELSE el.b END AS b
  FROM el
  JOIN ag ON ag.id = el.id
  JOIN rows_new ON rows_new.id = el.id
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;

-- What the page says of the day: until 6:10 p. m.
UPDATE "Event"
SET "landingBlocks" = replace(replace("landingBlocks"::text,
    'de 8 a. m. a 6 p. m.', 'de 8 a. m. a 6:10 p. m.'),
    'de 8:00 a. m. a 6:00 p. m.', 'de 8:00 a. m. a 6:10 p. m.')::jsonb
WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
  AND ("landingBlocks"::text LIKE '%de 8 a. m. a 6 p. m.%' OR "landingBlocks"::text LIKE '%de 8:00 a. m. a 6:00 p. m.%');

-- The day ends at 6:10 p. m. (Colombia): the confirmation, the ticket and the calendar say so.
UPDATE "Event" SET "endsAt" = TIMESTAMP '2027-06-27 23:10:00'
WHERE theme = 'IMPARABLES' AND "endsAt" = TIMESTAMP '2027-06-27 23:00:00';

UPDATE "Event"
SET "scheduleDays" = jsonb_build_array(jsonb_set("scheduleDays"->0, '{closesAt}', '"2027-06-27T23:10:00.000Z"'::jsonb))
WHERE theme = 'IMPARABLES' AND jsonb_typeof("scheduleDays") = 'array' AND jsonb_array_length("scheduleDays") = 1
  AND "scheduleDays"->0->>'closesAt' = '2027-06-27T23:00:00.000Z';
