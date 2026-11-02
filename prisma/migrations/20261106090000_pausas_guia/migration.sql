-- Manicuristas Imparables (the team, 2026-11-02): the active breaks name who guides them — «Con @ssanchezacademy ·
-- manicurista y fisioterapeuta», with the round photo (public/imparables/ssanchez.jpg) — in the band of each «Pausa
-- activa» of the program (components/imparables/ImparablesBlocks.tsx). Only a break nobody guides yet: one that
-- already names someone stays as it is.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
),
changed AS (
  SELECT ev.id, e.ordinality AS i,
    CASE
      WHEN e.value->>'type' = 'agenda' AND jsonb_typeof(e.value->'rows') = 'array' THEN
        jsonb_set(e.value, '{rows}', (
          SELECT coalesce(jsonb_agg(
            CASE
              WHEN r.value->>'kind' = 'session' AND coalesce(r.value->>'topic', '') ILIKE 'Pausa%'
                AND coalesce(r.value->>'instructor', '') = '' AND coalesce(r.value->>'photoUrl', '') = ''
                THEN r.value || '{"instructor": "@ssanchezacademy · manicurista y fisioterapeuta", "photoUrl": "/imparables/ssanchez.jpg"}'::jsonb
              ELSE r.value
            END ORDER BY r.ordinality), '[]'::jsonb)
          FROM jsonb_array_elements(e.value->'rows') WITH ORDINALITY AS r(value, ordinality)
        ))
      ELSE e.value
    END AS b
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
