-- Manicuristas Imparables (the team, 2026-11-02): the 3:20 p. m. break, «Actívate» (five minutes of dancing), becomes
-- «Espalda sin dolor»: stretches for the neck, shoulders and back, to wake up after lunch and for the hours bent over
-- the table. With the other breaks (hands, breathing, eyes) it rounds out the care of the body she works with. Its
-- sponsor stays as it is. Only the row that still says the dancing, word for word.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
    AND "landingBlocks"::text LIKE '%Cinco minutos de baile para despertar después del almuerzo.%'
),
changed AS (
  SELECT ev.id, e.ordinality AS i,
    CASE
      WHEN e.value->>'type' = 'agenda' AND jsonb_typeof(e.value->'rows') = 'array' THEN
        jsonb_set(e.value, '{rows}', (
          SELECT coalesce(jsonb_agg(
            CASE
              WHEN r.value->>'text' = 'Cinco minutos de baile para despertar después del almuerzo.'
                THEN r.value || '{"label": "Espalda sin dolor", "text": "Estiramientos de cuello, hombros y espalda para las horas en la mesa de trabajo."}'::jsonb
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
