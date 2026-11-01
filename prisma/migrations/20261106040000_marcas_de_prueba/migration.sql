-- Manicuristas Imparables, a test page for now (the team, 2026-11-01): four sample brands until the real ones sign.
-- Their logos (public/imparables/marcas) go in the hidden «Nuestros patrocinadores» gallery, which the cover shows
-- under «Organiza Nail Fest» as «Con el apoyo de»; and each active break gets its theme, what it brings and «Presentada
-- por» with one of them. Only where nothing was written yet: real logos and real pauses are never overwritten.
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
      WHEN b->>'type' = 'gallery' AND prev->>'type' = 'heading'
        AND (prev->>'eyebrow' ILIKE '%apoyo%' OR prev->>'title' ILIKE '%patrocin%')
        AND jsonb_array_length(coalesce(b->'items', '[]'::jsonb)) = 0
        THEN jsonb_set(b, '{items}', '[
          {"url": "/imparables/marcas/marca-1.png", "handle": "Marca uno"},
          {"url": "/imparables/marcas/marca-2.png", "handle": "Marca dos"},
          {"url": "/imparables/marcas/marca-3.png", "handle": "Marca tres"},
          {"url": "/imparables/marcas/marca-4.png", "handle": "Marca cuatro"}
        ]'::jsonb)
      WHEN b->>'type' = 'agenda' AND jsonb_typeof(b->'rows') = 'array' THEN
        jsonb_set(b, '{rows}', (
          SELECT coalesce(jsonb_agg(
            CASE
              WHEN r.value->>'kind' = 'session' AND coalesce(r.value->>'instructor', '') = '' AND r.value->>'topic' ILIKE 'Pausa%'
                AND coalesce(r.value->>'label', '') = '' AND coalesce(r.value->>'text', '') = ''
                AND coalesce(r.value->>'brand', '') = '' AND coalesce(r.value->>'brandLogoUrl', '') = ''
                THEN r.value || CASE r.value->>'chip'
                  WHEN '10:20 a. m.' THEN '{"label": "Manos que trabajan", "text": "Estiramientos y automasaje de manos, muñecas y dedos.", "sponsored": true, "brand": "Marca uno", "brandLogoUrl": "/imparables/marcas/marca-1.png"}'::jsonb
                  WHEN '11:35 a. m.' THEN '{"label": "Respira y suelta", "text": "Respiración guiada para soltar la tensión antes de hablar de plata.", "sponsored": true, "brand": "Marca dos", "brandLogoUrl": "/imparables/marcas/marca-2.png"}'::jsonb
                  WHEN '3:20 p. m.' THEN '{"label": "Actívate", "text": "Cinco minutos de baile para despertar después del almuerzo.", "sponsored": true, "brand": "Marca tres", "brandLogoUrl": "/imparables/marcas/marca-3.png"}'::jsonb
                  WHEN '4:35 p. m.' THEN '{"label": "Ojos que descansan", "text": "Ejercicios de enfoque y relajación visual para el trabajo de detalle.", "sponsored": true, "brand": "Marca cuatro", "brandLogoUrl": "/imparables/marcas/marca-4.png"}'::jsonb
                  ELSE '{}'::jsonb
                END
              ELSE r.value
            END ORDER BY r.ordinality), '[]'::jsonb)
          FROM jsonb_array_elements(b->'rows') WITH ORDINALITY AS r(value, ordinality)
        ))
      ELSE b
    END AS b
  FROM el
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
