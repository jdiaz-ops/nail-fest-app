-- Manicuristas Imparables' page, as the team asked (2026-10-31): the hidden
-- «Lo que vas a resolver en un solo día» shows again — its three cards written
-- from the agenda's talks — right after the intro, and the hidden guarantee card
-- shows at the end of «Todo lo que trae tu boleta». Blocks are matched by what
-- they are, never by their place in the list; an event without them is left as
-- it is. Content, so it can be edited from the admin afterwards.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array'
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality::numeric AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
kinds AS (
  SELECT id, b, i,
    (b->>'type' = 'heading' AND (b->>'title' = 'Lo que vas a resolver en un solo día' OR b->>'eyebrow' = 'Resultados')) AS is_results_heading,
    (b->>'type' = 'slides' AND b->>'style' = 'results') AS is_results,
    (b->>'type' = 'card' AND b->>'eyebrow' LIKE 'Garant%') AS is_guarantee
  FROM el
),
anchors AS (
  SELECT id,
    MIN(i) FILTER (WHERE b->>'type' = 'text' AND COALESCE((b->>'hidden')::boolean, false) = false) AS after_text,
    MIN(i) FILTER (WHERE b->>'type' = 'points' AND COALESCE((b->>'hidden')::boolean, false) = false) AS after_points
  FROM kinds GROUP BY id
),
placed AS (
  SELECT k.id,
    CASE
      WHEN k.is_results_heading THEN jsonb_set(k.b, '{hidden}', 'false'::jsonb)
      WHEN k.is_results THEN jsonb_set(jsonb_set(k.b, '{hidden}', 'false'::jsonb), '{items}', $items$[{"tag": "Mentalidad", "title": "Deja de pensar en pequeño", "text": "Cómo pasaron de la mesa de manicure a marcas con sedes: las decisiones que tomaron, los riesgos que corrieron y cómo se levantaron cuando se puso duro.", "noteLabel": "Sales sabiendo", "note": "qué decisión te toca tomar primero.", "who": "Jimena Montalban, Cristina Sierra, Oskar Garzón y el panel", "icon": "none"}, {"tag": "Dinero", "title": "Cobra lo que vales y sabe cuánto te queda", "text": "Precios, costos y utilidad con herramientas sencillas para usar desde el lunes; cobrar sin culpa, delegar y dejar de hacerlo todo sola.", "noteLabel": "Sales sabiendo", "note": "cuánto cobrar, cuánto gastas y cuánto te queda de verdad.", "who": "Alejandro Salinas, Paula Chacón y Juan Tenorio", "icon": "none"}, {"tag": "Marketing", "title": "Llena tu agenda con tu propio sello", "text": "Una marca que tus clientas reconozcan, contenido que trae citas —del primer mensaje a la cita confirmada— y un servicio que las hace volver y recomendarte.", "noteLabel": "Sales sabiendo", "note": "qué publicar primero y cómo responder para cerrar la cita.", "who": "Karen Pinzón, Fabi Pinillo Martínez y Juan Tenorio", "icon": "none"}]$items$::jsonb)
      WHEN k.is_guarantee THEN jsonb_set(k.b, '{hidden}', 'false'::jsonb)
      ELSE k.b
    END AS b,
    CASE
      WHEN k.is_results_heading AND a.after_text IS NOT NULL THEN a.after_text + 0.1
      WHEN k.is_results AND a.after_text IS NOT NULL THEN a.after_text + 0.2
      WHEN k.is_guarantee AND a.after_points IS NOT NULL THEN a.after_points + 0.1
      ELSE k.i
    END AS k
  FROM kinds k JOIN anchors a USING (id)
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY k) AS blocks FROM placed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;

-- The guarantee under the cover's button is the event's «Texto debajo del botón»: the template's words where the
-- event has none.
UPDATE "Event"
SET "ctaNote" = 'Garantía de 30 minutos: si en la primera media hora sientes que no es para ti, te devolvemos el 100%.'
WHERE theme = 'IMPARABLES' AND COALESCE(btrim("ctaNote"), '') = '';
