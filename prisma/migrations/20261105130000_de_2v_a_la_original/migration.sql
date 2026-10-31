-- What the team liked on 2v, on Manicuristas Imparables' main page too
-- (2026-10-31): the speakers' title and line, the paragraph under each part
-- of the program, and the questions that sell before the logistics ones —
-- these with the page's own 30 minutes' guarantee. Matched by what the blocks
-- are; content, so it can be edited from the admin afterwards.
WITH ev AS (
  SELECT id, "landingBlocks" AS blocks
  FROM "Event"
  WHERE theme = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND jsonb_array_length("landingBlocks") > 0
),
el AS (
  SELECT ev.id, e.value AS b, e.ordinality AS i,
    LEAD(e.value->>'type') OVER (PARTITION BY ev.id ORDER BY e.ordinality) AS next_type
  FROM ev CROSS JOIN LATERAL jsonb_array_elements(ev.blocks) WITH ORDINALITY AS e(value, ordinality)
),
faqs AS (
  SELECT id, MIN(i) AS first_faq FROM el WHERE b->>'type' = 'faq' AND COALESCE((b->>'hidden')::boolean, false) = false GROUP BY id
),
changed AS (
  SELECT el.id, el.i,
    CASE
      -- The speakers' heading: the empty one right before them.
      WHEN el.b->>'type' = 'heading' AND COALESCE(btrim(el.b->>'title'), '') = '' AND COALESCE(btrim(el.b->>'eyebrow'), '') = '' AND el.next_type = 'people'
        THEN el.b || '{"title": "De quién vas a aprender", "intro": "Elegidos por una razón: todos empezaron donde tú estás hoy y vienen a contarte exactamente qué hicieron."}'::jsonb
      -- The program: its parts' paragraphs.
      WHEN el.b->>'type' = 'agenda' THEN jsonb_set(el.b, '{rows}', (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN r->>'kind' = 'day' AND lower(r->>'chip') LIKE '%mañana%' THEN jsonb_set(r, '{takeaway}', to_jsonb($t$Vas a escuchar cuatro historias que se parecen a la tuya: la mesa alquilada, el miedo a cobrar, el día en que casi lo dejan. Y vas a escribir en tu cuaderno el miedo que desde hoy dejas de usar como excusa.$t$::text))
            WHEN r->>'kind' = 'day' AND lower(r->>'chip') LIKE '%tarde%' THEN jsonb_set(r, '{takeaway}', to_jsonb($t$Ahora te toca a ti. Paso a paso, con tus propios números y tu propio Instagram abiertos, vas a armar el plan: cuánto cobrar, cómo verte, cómo atraer, cómo retener. Al final, Oskar cierra y tú firmas tu ruta.$t$::text))
            ELSE r
          END ORDER BY o), '[]'::jsonb)
        FROM jsonb_array_elements(el.b->'rows') WITH ORDINALITY AS y(r, o)))
      -- The first list of questions: the ones that sell first (none twice).
      WHEN el.b->>'type' = 'faq' AND el.i = f.first_faq THEN jsonb_set(el.b, '{items}',
        $q$[{"question": "¿De verdad vale la pena?", "answer": "Si llevas años trabajando y sientes que el negocio no crece, sí. No es un curso de técnica: es un día para decidir cuánto cobras, cómo te ves, cómo atraes y cómo retienes, con la gente que ya lo hizo. Y si en la primera media hora sientes que no es para ti, te devolvemos la plata."}, {"question": "¿Por qué pagar por esto si puedo ver videos gratis en Instagram?", "answer": "Porque en Instagram ves pedazos; aquí ves el camino completo, en orden, con un cuaderno para aterrizarlo a tu negocio y con 500 colegas haciendo lo mismo el mismo día."}, {"question": "¿Me sirve si llevo poco tiempo? ¿Y si llevo muchos años?", "answer": "Sirve si ya tienes clientas y sientes que estás estancada. Las historias de la mañana son para las dos; el plan de la tarde se arma con tus números, lleves uno o quince años."}, {"question": "¿Cómo me va a servir dentro de tres meses?", "answer": "Sales con tu ruta escrita: lo que cambias, cuándo y cómo sabrás que funcionó. La página «Mi ruta» del cuaderno se llena el mismo 27 de junio y es lo que vas a revisar a los 90 días."}, {"question": "¿Qué me llevo exactamente?", "answer": "Nueve charlas en vivo, un panel, tu cuaderno con tu plan, las guías de los conferencistas, la repetición por 30 días y tu diploma."}, {"question": "¿Cómo hago para no distraerme 11 horas?", "answer": "El día está armado en bloques de dos charlas con pausas activas, una hora de almuerzo y el cuaderno para escribir mientras escuchas. Y lo que te pierdas lo ves en la repetición."}, {"question": "¿Hay garantía?", "answer": "Sí. Si en la primera media hora sientes que no es para ti, escríbenos por WhatsApp y te devolvemos el 100 %."}]$q$::jsonb || (
          SELECT COALESCE(jsonb_agg(q ORDER BY o), '[]'::jsonb)
          FROM jsonb_array_elements(el.b->'items') WITH ORDINALITY AS z(q, o)
          WHERE NOT ($q$[{"question": "¿De verdad vale la pena?", "answer": "Si llevas años trabajando y sientes que el negocio no crece, sí. No es un curso de técnica: es un día para decidir cuánto cobras, cómo te ves, cómo atraes y cómo retienes, con la gente que ya lo hizo. Y si en la primera media hora sientes que no es para ti, te devolvemos la plata."}, {"question": "¿Por qué pagar por esto si puedo ver videos gratis en Instagram?", "answer": "Porque en Instagram ves pedazos; aquí ves el camino completo, en orden, con un cuaderno para aterrizarlo a tu negocio y con 500 colegas haciendo lo mismo el mismo día."}, {"question": "¿Me sirve si llevo poco tiempo? ¿Y si llevo muchos años?", "answer": "Sirve si ya tienes clientas y sientes que estás estancada. Las historias de la mañana son para las dos; el plan de la tarde se arma con tus números, lleves uno o quince años."}, {"question": "¿Cómo me va a servir dentro de tres meses?", "answer": "Sales con tu ruta escrita: lo que cambias, cuándo y cómo sabrás que funcionó. La página «Mi ruta» del cuaderno se llena el mismo 27 de junio y es lo que vas a revisar a los 90 días."}, {"question": "¿Qué me llevo exactamente?", "answer": "Nueve charlas en vivo, un panel, tu cuaderno con tu plan, las guías de los conferencistas, la repetición por 30 días y tu diploma."}, {"question": "¿Cómo hago para no distraerme 11 horas?", "answer": "El día está armado en bloques de dos charlas con pausas activas, una hora de almuerzo y el cuaderno para escribir mientras escuchas. Y lo que te pierdas lo ves en la repetición."}, {"question": "¿Hay garantía?", "answer": "Sí. Si en la primera media hora sientes que no es para ti, escríbenos por WhatsApp y te devolvemos el 100 %."}]$q$::jsonb @> jsonb_build_array(jsonb_build_object('question', q->>'question')))
        ))
      ELSE el.b
    END AS b
  FROM el LEFT JOIN faqs f USING (id)
),
agg AS (
  SELECT id, jsonb_agg(b ORDER BY i) AS blocks FROM changed GROUP BY id
)
UPDATE "Event" e SET "landingBlocks" = agg.blocks FROM agg WHERE e.id = agg.id;
