-- Manicuristas Imparables' questions, reviewed as the team asked (2026-10-31):
-- what the page kept hidden — the doubts «Mi caso es distinto» and «Ya hice
-- cursos y no me sirvieron», and «¿La boleta incluye IVA?» — joins the first
-- list of questions: the two doubts after «¿Me sirve si llevo poco tiempo?»,
-- the IVA one after «¿Cómo pago?». None twice; an event without those
-- questions is left as it is.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
faqs AS (
  SELECT id, MIN(i) AS first_faq FROM el WHERE b->>'type' = 'faq' AND COALESCE((b->>'hidden')::boolean, false) = false GROUP BY id
),
changed AS (
  SELECT el.id, el.i,
    CASE
      WHEN el.b->>'type' = 'faq' AND el.i = f.first_faq THEN jsonb_set(el.b, '{items}', (
        SELECT COALESCE(jsonb_agg(piece ORDER BY o, k), '[]'::jsonb)
        FROM jsonb_array_elements(el.b->'items') WITH ORDINALITY AS z(q, o)
        CROSS JOIN LATERAL (
          SELECT q AS piece, 0 AS k
          UNION ALL
          SELECT extra, 1 + n
          FROM jsonb_array_elements(
            CASE
              WHEN q->>'question' LIKE '¿Me sirve si llevo poco tiempo?%' THEN $s$[{"question": "¿Y si mi caso es distinto?", "answer": "Hay caminos de todo tipo: independiente, salón, cadena, academia, y empezar de cero en otro país. Las historias de la mañana cubren todos; el plan de la tarde lo armas con tu propio caso."}, {"question": "¿Y si ya hice cursos y no me sirvieron?", "answer": "Aquí no hay teoría: te cuentan cómo lo hicieron manicuristas que empezaron donde tú estás, y sales con tu plan escrito en tu cuaderno, no con notas sueltas. Y si en la primera media hora sientes que no es para ti, te devolvemos el 100 %."}]$s$::jsonb
              WHEN q->>'question' = '¿Cómo pago?' THEN $l$[{"question": "¿La boleta incluye IVA?", "answer": "Sí. El precio que ves ya incluye el IVA del 19 %; no hay cobros adicionales."}]$l$::jsonb
              ELSE '[]'::jsonb
            END
          ) WITH ORDINALITY AS x(extra, n)
          WHERE NOT (el.b->'items' @> jsonb_build_array(jsonb_build_object('question', extra->>'question')))
        ) AS pieces
      ))
      ELSE el.b
    END AS b
  FROM el LEFT JOIN faqs f USING (id)
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
