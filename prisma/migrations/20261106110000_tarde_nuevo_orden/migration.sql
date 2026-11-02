-- Manicuristas Imparables (the team, 2026-11-02): the afternoon in a new order. Karen Pinzón opens it, then Fabi
-- Pinillo Martínez, Juan Tenorio and Oskar Garzón, and Heidy's closing last. Each talk keeps its length (Karen 60
-- minutes, Fabi 65, Juan 60, Oskar 30) and everything of its own (talk, photo, Instagram, note); the two afternoon
-- breaks, with their themes, guide and sponsors, go after Karen and after Fabi, so no two long talks run back to back:
-- 1:50 Karen · 2:50 break · 3:00 Fabi · 4:05 break · 4:15 Juan · 5:15 Oskar · 5:45 closing, until 6:00 p. m. as
-- before. The morning stays as it is. An afternoon that doesn't hold exactly these lines is left as it is.
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
      WHEN x.value->>'kind' = 'day' AND x.value->>'chip' ILIKE 'Tarde%' THEN 'tarde'
      WHEN x.value->>'instructor' ILIKE 'Karen%' THEN 'karen'
      WHEN x.value->>'instructor' ILIKE 'Fabi%' THEN 'fabi'
      WHEN x.value->>'instructor' ILIKE 'Juan Tenorio%' THEN 'juan'
      WHEN x.value->>'instructor' ILIKE 'Oskar%' THEN 'oskar'
      WHEN coalesce(x.value->>'topic', '') ILIKE 'Pausa%' THEN 'pausa'
      WHEN coalesce(x.value->>'instructor', '') = '' AND x.value->>'topic' ILIKE 'Cierre%' THEN 'cierre'
    END AS k
  FROM ag CROSS JOIN LATERAL jsonb_array_elements(ag.b->'rows') WITH ORDINALITY AS x(value, ordinality)
),
t AS (
  SELECT id, min(j) AS jt FROM r WHERE k = 'tarde' GROUP BY id
),
aft AS (
  SELECT r.id, r.row, r.j, r.k, row_number() OVER (PARTITION BY r.id, r.k ORDER BY r.j) AS n
  FROM r JOIN t ON t.id = r.id
  WHERE r.j > t.jt
),
ok AS (
  SELECT id FROM aft GROUP BY id
  HAVING count(*) = 7
     AND count(*) FILTER (WHERE k = 'karen') = 1
     AND count(*) FILTER (WHERE k = 'fabi') = 1
     AND count(*) FILTER (WHERE k = 'juan') = 1
     AND count(*) FILTER (WHERE k = 'oskar') = 1
     AND count(*) FILTER (WHERE k = 'pausa') = 2
     AND count(*) FILTER (WHERE k = 'cierre') = 1
),
plan(ord, k, n, chip) AS (
  VALUES
    (1, 'karen', 1, '1:50 p. m.'),
    (2, 'pausa', 1, '2:50 p. m.'),
    (3, 'fabi', 1, '3:00 p. m.'),
    (4, 'pausa', 2, '4:05 p. m.'),
    (5, 'juan', 1, '4:15 p. m.'),
    (6, 'oskar', 1, '5:15 p. m.'),
    (7, 'cierre', 1, '5:45 p. m.')
),
rows_new AS (
  SELECT ok.id,
    (SELECT jsonb_agg(r.row ORDER BY r.j) FROM r JOIN t ON t.id = r.id WHERE r.id = ok.id AND r.j <= t.jt)
    || (SELECT jsonb_agg(a.row || jsonb_build_object('chip', p.chip) ORDER BY p.ord)
        FROM plan p JOIN aft a ON a.id = ok.id AND a.k = p.k AND a.n = p.n) AS rows
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
