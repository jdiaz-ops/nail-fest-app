-- Manicuristas Imparables' questions (the team, 2026-10-31): eight of them
-- leave the page — into the hidden list of questions that already follows
-- the visible one (or a new hidden list right after it), so nothing is
-- lost — and «¿Por qué pagar por esto…?» keeps only its first sentence.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
vis AS (
  SELECT DISTINCT ON (id) id, i, b FROM el
  WHERE b->>'type' = 'faq' AND coalesce((b->>'hidden')::boolean, false) = false AND jsonb_typeof(b->'items') = 'array'
  ORDER BY id, i
),
hid AS (
  SELECT DISTINCT ON (el.id) el.id, el.i, el.b FROM el JOIN vis ON vis.id = el.id AND el.i > vis.i
  WHERE el.b->>'type' = 'faq' AND coalesce((el.b->>'hidden')::boolean, false) = true AND jsonb_typeof(el.b->'items') = 'array'
  ORDER BY el.id, el.i
),
moved AS (
  SELECT vis.id, jsonb_agg(it.value ORDER BY it.ordinality) AS items
  FROM vis CROSS JOIN LATERAL jsonb_array_elements(vis.b->'items') WITH ORDINALITY AS it(value, ordinality)
  WHERE it.value->>'question' IN ('¿Y si mi caso es distinto?', '¿Cómo me va a servir dentro de tres meses?', '¿Qué me llevo exactamente?', '¿Cómo hago para no distraerme 11 horas?', '¿Hay garantía?', '¿La boleta incluye IVA?', '¿Por qué sube el precio?', '¿Puedo pedir reembolso?')
  GROUP BY vis.id
),
kept AS (
  SELECT vis.id, coalesce(jsonb_agg(
    CASE
      WHEN it.value->>'question' = '¿Por qué pagar por esto si puedo ver videos gratis en Instagram?'
        THEN jsonb_set(it.value, '{answer}', to_jsonb('Porque en Instagram ves pedazos; aquí ves el camino completo.'::text))
      ELSE it.value
    END ORDER BY it.ordinality), '[]'::jsonb) AS items
  FROM vis CROSS JOIN LATERAL jsonb_array_elements(vis.b->'items') WITH ORDINALITY AS it(value, ordinality)
  WHERE it.value->>'question' NOT IN ('¿Y si mi caso es distinto?', '¿Cómo me va a servir dentro de tres meses?', '¿Qué me llevo exactamente?', '¿Cómo hago para no distraerme 11 horas?', '¿Hay garantía?', '¿La boleta incluye IVA?', '¿Por qué sube el precio?', '¿Puedo pedir reembolso?')
  GROUP BY vis.id
),
hidden_new AS (
  SELECT m.id,
    coalesce(h.b->'items', '[]'::jsonb) || coalesce((
      SELECT jsonb_agg(mv.value ORDER BY mv.ordinality)
      FROM jsonb_array_elements(m.items) WITH ORDINALITY AS mv(value, ordinality)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(coalesce(h.b->'items', '[]'::jsonb)) AS ex(value)
        WHERE ex.value->>'question' = mv.value->>'question'
      )
    ), '[]'::jsonb) AS items
  FROM moved m LEFT JOIN hid h ON h.id = m.id
),
outb AS (
  SELECT el.id, el.i::numeric AS pos,
    CASE
      WHEN vis.i = el.i AND moved.id IS NOT NULL THEN jsonb_set(el.b, '{items}', coalesce(kept.items, '[]'::jsonb))
      WHEN hid.i = el.i AND hidden_new.items IS NOT NULL THEN jsonb_set(el.b, '{items}', hidden_new.items)
      ELSE el.b
    END AS b
  FROM el
  LEFT JOIN vis ON vis.id = el.id
  LEFT JOIN moved ON moved.id = el.id
  LEFT JOIN kept ON kept.id = el.id
  LEFT JOIN hid ON hid.id = el.id
  LEFT JOIN hidden_new ON hidden_new.id = el.id
  UNION ALL
  SELECT m.id, vis.i::numeric + 0.5, jsonb_build_object('type', 'faq', 'title', '', 'items', m.items, 'hidden', true)
  FROM moved m JOIN vis ON vis.id = m.id LEFT JOIN hid ON hid.id = m.id
  WHERE hid.id IS NULL
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY pos) AS blocks FROM outb GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
