-- Manicuristas Imparables' «Lo que vas a resolver en un solo día», as the team
-- asked (2026-10-31): its label «Tu negocio no va a ser el mismo» and its three
-- cards' words. Matched by what the blocks are, never by their place; content,
-- so it can be edited from the admin afterwards.
UPDATE "Event" e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN x.b->>'type' = 'heading' AND x.b->>'title' = 'Lo que vas a resolver en un solo día'
        THEN jsonb_set(x.b, '{eyebrow}', '"Tu negocio no va a ser el mismo"'::jsonb)
      WHEN x.b->>'type' = 'slides' AND x.b->>'style' = 'results'
        THEN jsonb_set(x.b, '{items}', $items$[{"tag": "Mentalidad", "title": "Deja de pensar en pequeño", "text": "Cómo pasaron de la mesa de manicure a marcas con sedes: las decisiones que tomaron, los riesgos que corrieron y cómo se levantaron cuando se puso duro.", "noteLabel": "Sales sabiendo", "note": "qué miedo dejas de usar como excusa y qué decisión te toca tomar primero.", "who": "Jimena Montalban, Cristina Sierra, Oskar Garzón y el panel", "icon": "none"}, {"tag": "Dinero", "title": "Cobra lo que vales y sabe cuánto te queda", "text": "Cobrar sin culpa, saber cuánto te queda de verdad y dejar de hacerlo todo sola. Herramientas sencillas para usar desde el lunes.", "noteLabel": "Sales sabiendo", "note": "cuánto cobrar, cuánto gastas y cuánto te queda de verdad.", "who": "Alejandro Salinas y Paula Chacón", "icon": "none"}, {"tag": "Marketing", "title": "Llena tu agenda y haz que vuelvan", "text": "Una marca que tus clientas reconozcan, contenido que trae citas y un servicio que las hace volver y recomendarte.", "noteLabel": "Sales sabiendo", "note": "qué publicar primero y cómo responder para cerrar la cita.", "who": "Karen Pinzón, Fabi Pinillo Martínez y Juan Tenorio", "icon": "none"}]$items$::jsonb)
      ELSE x.b
    END
    ORDER BY x.ordinality
  )
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS x(b, ordinality)
)
WHERE e.theme = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND jsonb_array_length(e."landingBlocks") > 0;
