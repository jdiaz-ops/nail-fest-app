-- Manicuristas Imparables' page as the team approved it on 2026-10-26: the
-- cover's group photo (an image before the first section title), the 3
-- results before the speakers, the doubts before the questions, each day's
-- «Te llevas» and star talk in the program (Jimena's and the panel), and
-- «Imparables pasa una vez al año.» under the cover's countdown («Texto
-- debajo del botón», not shown anywhere else in this design). Added to the
-- events already made from the template (theme IMPARABLES) where each piece
-- is missing; nothing on them is removed, and the team edits every piece in
-- the event's «Contenido».
DO $$
DECLARE
  ev RECORD;
  blocks jsonb;
  first_heading bigint;
  speakers_at bigint;
  questions_at bigint;
  has_cover boolean;
  has_results boolean;
  has_doubts boolean;
  cover jsonb := '{"type": "image", "url": "/imparables/grupo.webp", "caption": ""}'::jsonb;
  results jsonb := '[{"type": "heading", "eyebrow": "Resultados", "title": "Lo que vas a resolver en estos dos días", "intro": ""}, {"type": "slides", "style": "results", "items": [{"tag": "Más clientas", "title": "Llena tu agenda sin depender del voz a voz", "text": "Redes que atraen clientas, tu marca y marketing con inteligencia artificial.", "noteLabel": "Sales sabiendo", "note": "qué publicar primero.", "who": "Fabi, Alejandro Salinas y Oskar", "icon": "none"}, {"tag": "Más ganancia", "title": "Cobra lo que vales, sin culpa", "text": "Cuánto cobrar, cuánto ahorrar y cómo hablar de plata con tus clientas.", "noteLabel": "Sales sabiendo", "note": "cuánto debe dejarte cada servicio.", "who": "Juan Tenorio, Pau y el panel", "icon": "none"}, {"tag": "Tu negocio", "title": "De la mesa a dueña de tu marca", "text": "Pasar de atender sola a tener salón, equipo o academia, y empezar de cero si te toca.", "noteLabel": "Sales sabiendo", "note": "cuál es tu primer paso.", "who": "Jimena, Cris Sierra y Maris", "icon": "none"}]}]'::jsonb;
  doubts jsonb := '[{"type": "heading", "eyebrow": "Si todavía dudas", "title": "¿Todavía lo estás pensando?", "intro": ""}, {"type": "slides", "style": "doubts", "items": [{"tag": "", "title": "No tengo tiempo.", "text": "Son dos mañanas, de 9:00 a. m. a 2:00 p. m., desde tu celular. Y si no puedes en vivo, tienes la repetición por 30 días.", "noteLabel": "Incluido", "note": "La repetición por 30 días viene con tu boleta.", "who": "", "icon": "clock"}, {"tag": "", "title": "Apenas estoy empezando.", "text": "Es de negocio, no de técnica: te sirve desde tu primera clienta.", "noteLabel": "Prueba", "note": "Pau empezó en una mesa de manicure y hoy es CEO de El Imperio de las Uñas.", "who": "Pau", "icon": "none"}, {"tag": "", "title": "Mi caso es distinto.", "text": "Hay caminos de todo tipo: independiente, salón, cadena, academia, y empezar de cero en otro país.", "noteLabel": "Prueba", "note": "Maris empezó desde nada y hoy forma educadoras en Chile.", "who": "Maris", "icon": "none"}, {"tag": "", "title": "Ya hice cursos y no me sirvieron.", "text": "Aquí no hay teoría: te cuentan cómo lo hicieron manicuristas que empezaron donde tú estás.", "noteLabel": "Garantía", "note": "Si en los primeros 30 minutos no es para ti, te devolvemos el 100%.", "who": "", "icon": "shield"}]}]'::jsonb;
BEGIN
  FOR ev IN
    SELECT id, "landingBlocks" AS lb FROM "Event"
    -- Nothing here may fail on a page saved some other way: only lists of blocks.
    WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' AND "landingBlocks" <> '[]'::jsonb
  LOOP
    blocks := ev.lb;
    SELECT min(x.n) INTO first_heading FROM jsonb_array_elements(blocks) WITH ORDINALITY AS x(b, n) WHERE x.b ->> 'type' = 'heading';
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(blocks) WITH ORDINALITY AS x(b, n)
      WHERE x.b ->> 'type' = 'image' AND x.n < COALESCE(first_heading, 9223372036854775807)
    ) INTO has_cover;
    SELECT min(x.n) INTO speakers_at FROM jsonb_array_elements(blocks) WITH ORDINALITY AS x(b, n)
      WHERE x.b ->> 'type' = 'heading' AND btrim(COALESCE(x.b ->> 'eyebrow', '')) ILIKE 'speakers';
    SELECT min(x.n) INTO questions_at FROM jsonb_array_elements(blocks) WITH ORDINALITY AS x(b, n)
      WHERE x.b ->> 'type' = 'heading' AND btrim(COALESCE(x.b ->> 'eyebrow', '')) ILIKE 'preguntas frecuentes';
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(blocks) AS x(b) WHERE x.b ->> 'type' = 'slides' AND COALESCE(x.b ->> 'style', 'results') = 'results') INTO has_results;
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(blocks) AS x(b) WHERE x.b ->> 'type' = 'slides' AND x.b ->> 'style' = 'doubts') INTO has_doubts;

    SELECT COALESCE(jsonb_agg(y.block ORDER BY y.n, y.k), '[]'::jsonb) INTO blocks FROM (
      -- Every block as it was; in the program, each day's «Te llevas» (where it has none) and the star talks.
      SELECT b.n, 100::bigint AS k,
        CASE
          WHEN b.block ->> 'type' = 'agenda' AND jsonb_typeof(b.block -> 'rows') = 'array' THEN jsonb_set(b.block, '{rows}', COALESCE((
            SELECT jsonb_agg(
              CASE
                WHEN r.line ->> 'kind' = 'day' AND COALESCE(r.line ->> 'takeaway', '') = '' AND r.line ->> 'chip' ILIKE 'Domingo%'
                  THEN r.line || jsonb_build_object('takeaway', 'cuánto cobrar sin culpa y el camino para pasar de la mesa a tu propia marca.')
                WHEN r.line ->> 'kind' = 'day' AND COALESCE(r.line ->> 'takeaway', '') = '' AND r.line ->> 'chip' ILIKE 'Lunes%'
                  THEN r.line || jsonb_build_object('takeaway', 'cómo mostrarte y llenar tu agenda, con contenido e IA, y el empujón para dar tu siguiente paso.')
                WHEN COALESCE(r.line ->> 'kind', 'session') = 'session'
                  AND (r.line ->> 'instructor' = 'Jimena' OR (COALESCE(r.line ->> 'instructor', '') = '' AND r.line ->> 'topic' ILIKE 'Panel%'))
                  THEN r.line || '{"star": true}'::jsonb
                ELSE r.line
              END
              ORDER BY r.n)
            FROM jsonb_array_elements(b.block -> 'rows') WITH ORDINALITY AS r(line, n)
          ), '[]'::jsonb))
          ELSE b.block
        END AS block
      FROM jsonb_array_elements(blocks) WITH ORDINALITY AS b(block, n)
      -- The group photo, first of all.
      UNION ALL
      SELECT 1, 0, cover WHERE NOT has_cover
      -- The 3 results, right before the speakers.
      UNION ALL
      SELECT speakers_at, i.k, i.block FROM jsonb_array_elements(results) WITH ORDINALITY AS i(block, k) WHERE speakers_at IS NOT NULL AND NOT has_results
      -- The doubts, right before the questions.
      UNION ALL
      SELECT questions_at, i.k, i.block FROM jsonb_array_elements(doubts) WITH ORDINALITY AS i(block, k) WHERE questions_at IS NOT NULL AND NOT has_doubts
    ) AS y;

    UPDATE "Event" SET "landingBlocks" = blocks WHERE id = ev.id;
  END LOOP;

  UPDATE "Event" SET "ctaNote" = 'Imparables pasa una vez al año.' WHERE "theme" = 'IMPARABLES';
END $$;
