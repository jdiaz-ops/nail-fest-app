-- Manicuristas Imparables (the team, 2026-11-01): nothing about a guarantee on the page for now. The card «Garantía
-- de 30 minutos» under «Qué incluye» is hidden (the admin can show it again), and two answers lose their last
-- sentence about it. «¿Hay garantía?» and «¿Puedo pedir reembolso?» were hidden already.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
changed AS (
  SELECT id, i,
    CASE
      WHEN b->>'type' = 'card' AND b->>'eyebrow' ILIKE 'Garant%' THEN jsonb_set(b, '{hidden}', 'true'::jsonb)
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;

UPDATE "Event"
SET "landingBlocks" = replace(replace("landingBlocks"::text,
    ' Y si en la primera media hora sientes que no es para ti, te devolvemos la plata.', ''),
    ' Y si en la primera media hora sientes que no es para ti, te devolvemos el 100 %.', '')::jsonb
WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
