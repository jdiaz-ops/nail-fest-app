-- Manicuristas Imparables, «Todo lo que trae tu boleta» (the team,
-- 2026-10-31): the certificate is the diploma, and the replay is told the
-- way 2v tells it.
--   «Certificado digital» → «Tu diploma Imparable 2027 · Con tu nombre, para tu salón.»
--   «Repetición por 30 días» → «Vuelve a verlo cuando lo necesites · Las charlas quedan disponibles 30 días.»
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
changed AS (
  SELECT id, i,
    CASE
      WHEN b->>'type' = 'points' AND jsonb_typeof(b->'items') = 'array' THEN
        jsonb_set(b, '{items}', (
          SELECT coalesce(jsonb_agg(
            CASE
              WHEN it.value->>'title' = 'Certificado digital'
                THEN it.value || jsonb_build_object('title', 'Tu diploma Imparable 2027', 'text', 'Con tu nombre, para tu salón.')
              WHEN it.value->>'title' = 'Repetición por 30 días'
                THEN it.value || jsonb_build_object('title', 'Vuelve a verlo cuando lo necesites', 'text', 'Las charlas quedan disponibles 30 días.')
              ELSE it.value
            END ORDER BY it.ordinality), '[]'::jsonb)
          FROM jsonb_array_elements(b->'items') WITH ORDINALITY AS it(value, ordinality)
        ))
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
