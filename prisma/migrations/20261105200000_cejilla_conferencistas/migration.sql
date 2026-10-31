-- Manicuristas Imparables (the team, 2026-10-31): the speakers' heading —
-- the one right before the first people block, «De quién vas a aprender» —
-- gets the eyebrow «Conferencistas», to open the section like the others.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
first_people AS (
  SELECT id, min(i) AS i FROM el WHERE b->>'type' = 'people' GROUP BY id
),
changed AS (
  SELECT el.id, el.i,
    CASE
      WHEN el.b->>'type' = 'heading' AND el.i = fp.i - 1 AND coalesce(el.b->>'title', '') <> '' AND coalesce(el.b->>'eyebrow', '') = ''
        THEN jsonb_set(el.b, '{eyebrow}', '"Conferencistas"'::jsonb)
      ELSE el.b
    END AS b
  FROM el LEFT JOIN first_people fp ON fp.id = el.id
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
