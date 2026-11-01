-- Manicuristas Imparables' program, rearranged (the team, 2026-11-01): the three pillars in order, 8:00 a. m. to
-- 6:00 p. m. Mentalidad in the morning (Cristina Sierra opens, then Jimena Montalban and Paula Chacón), Dinero before
-- lunch (Alejandro Salinas), Marketing in the afternoon (Oskar Garzón opens it, then Karen Pinzón, Fabi Pinillo
-- Martínez and Juan Tenorio); four active breaks of 10 minutes, one per sponsor; no panel.
-- Every line keeps all of its own (talk, photo, Instagram, note): only its hour and its place change. A program that
-- doesn't hold exactly these lines is left as it is.
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
      WHEN x.value->>'instructor' = 'Cristina Sierra' THEN 'cristina'
      WHEN x.value->>'instructor' = 'Jimena Montalban' THEN 'jimena'
      WHEN x.value->>'instructor' = 'Paula Chacón' THEN 'paula'
      WHEN x.value->>'instructor' = 'Alejandro Salinas' THEN 'salinas'
      WHEN x.value->>'instructor' = 'Oskar Garzón' THEN 'oskar'
      WHEN x.value->>'instructor' = 'Karen Pinzón' THEN 'karen'
      WHEN x.value->>'instructor' = 'Fabi Pinillo Martínez' THEN 'fabi'
      WHEN x.value->>'instructor' = 'Juan Tenorio' THEN 'juan'
      WHEN x.value->>'topic' ILIKE 'Panel%' THEN 'panel'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE 'Bienvenida%' THEN 'bienvenida'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE '%almuerzo%' THEN 'almuerzo'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE 'Pausa%' THEN 'pausa'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE 'Cierre%' THEN 'cierre'
    END AS k
  FROM ag CROSS JOIN LATERAL jsonb_array_elements(ag.b->'rows') WITH ORDINALITY AS x(value, ordinality)
),
ok AS (
  SELECT id FROM r GROUP BY id
  HAVING count(*) FILTER (WHERE k IS NULL) = 0
     AND count(*) FILTER (WHERE k = 'pausa') >= 1
     AND count(*) FILTER (WHERE k NOT IN ('pausa', 'panel')) = 13
     AND count(DISTINCT k) FILTER (WHERE k NOT IN ('pausa', 'panel')) = 13
),
plan(ord, k, chip, extra) AS (
  VALUES
    (1, 'manana', NULL, '{"text": "8:00 a. m. a 12:50 p. m.", "takeaway": "Vas a escuchar tres historias que se parecen a la tuya: el día en que casi lo dejan, la mesa alquilada, el miedo a cobrar. Y antes del almuerzo, tus números en orden."}'::jsonb),
    (2, 'bienvenida', '8:00 a. m.', '{}'::jsonb),
    (3, 'cristina', '8:15 a. m.', '{}'::jsonb),
    (4, 'jimena', '9:15 a. m.', '{}'::jsonb),
    (5, 'pausa', '10:20 a. m.', '{}'::jsonb),
    (6, 'paula', '10:30 a. m.', '{}'::jsonb),
    (7, 'pausa', '11:35 a. m.', '{}'::jsonb),
    (8, 'salinas', '11:45 a. m.', '{}'::jsonb),
    (9, 'almuerzo', '12:50 p. m.', '{"text": "De 12:50 a 1:50 p. m."}'::jsonb),
    (10, 'tarde', NULL, '{"text": "1:50 p. m. a 6:00 p. m.", "takeaway": "Ahora te toca a ti. Paso a paso, con tus números ya claros, vas a armar el plan: cómo verte, cómo atraer, cómo retener."}'::jsonb),
    (11, 'oskar', '1:50 p. m.', '{}'::jsonb),
    (12, 'karen', '2:20 p. m.', '{}'::jsonb),
    (13, 'pausa', '3:20 p. m.', '{}'::jsonb),
    (14, 'fabi', '3:30 p. m.', '{}'::jsonb),
    (15, 'pausa', '4:35 p. m.', '{}'::jsonb),
    (16, 'juan', '4:45 p. m.', '{}'::jsonb),
    (17, 'cierre', '5:45 p. m.', '{}'::jsonb)
),
picked AS (
  SELECT ok.id, p.ord,
    (SELECT r.row FROM r WHERE r.id = ok.id AND r.k = p.k ORDER BY r.j LIMIT 1)
      || CASE WHEN p.chip IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('chip', p.chip) END
      || p.extra AS row
  FROM ok CROSS JOIN plan p
),
rows_new AS (
  SELECT id, jsonb_agg(row ORDER BY ord) AS rows FROM picked GROUP BY id
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

-- The panel's card and its guests, under the speakers: hidden (the admin can show them again).
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i,
    LAG(e.value) OVER (PARTITION BY ev.id ORDER BY e.ordinality) AS prev
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
changed AS (
  SELECT id, i,
    CASE
      WHEN b->>'type' = 'card' AND b->>'eyebrow' ILIKE 'Panel%' THEN jsonb_set(b, '{hidden}', 'true'::jsonb)
      WHEN b->>'type' = 'people' AND prev->>'type' = 'card' AND prev->>'eyebrow' ILIKE 'Panel%' THEN jsonb_set(b, '{hidden}', 'true'::jsonb)
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;

-- What the page says of the day: 8 speakers, no panel, until 6:00 p. m.
UPDATE "Event"
SET "landingBlocks" = replace(replace(replace(replace("landingBlocks"::text,
    '9 conferencistas y un panel, de 8 a. m. a 7 p. m.', '8 conferencistas, de 8 a. m. a 6 p. m.'),
    'de 8:00 a. m. a 7:00 p. m.', 'de 8:00 a. m. a 6:00 p. m.'),
    '¿Cómo hago para no distraerme 11 horas?', '¿Cómo hago para no distraerme 10 horas?'),
    'Nueve charlas en vivo, un panel, ', 'Ocho charlas en vivo, ')::jsonb
WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';

-- The day ends at 6:00 p. m. (Colombia), an hour earlier.
UPDATE "Event" SET "endsAt" = TIMESTAMP '2027-06-27 23:00:00'
WHERE theme = 'IMPARABLES' AND "endsAt" = TIMESTAMP '2027-06-28 00:00:00';

UPDATE "Event"
SET "scheduleDays" = jsonb_build_array(jsonb_set("scheduleDays"->0, '{closesAt}', '"2027-06-27T23:00:00.000Z"'::jsonb))
WHERE theme = 'IMPARABLES' AND jsonb_typeof("scheduleDays") = 'array' AND jsonb_array_length("scheduleDays") = 1
  AND "scheduleDays"->0->>'closesAt' = '2027-06-28T00:00:00.000Z';
