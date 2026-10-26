-- Manicuristas Imparables' host and panel in the team's words (2026-10-26).
-- Heidy's card keeps its design, photo and Instagram, with the new line
-- about her. The panel becomes «El día que decidí cambiar» and its four
-- made-up panelists go: each of their cards becomes «Por anunciar» with the
-- story it will tell, until the team fills in her name, Instagram and photo
-- in the event's «Contenido». The program's panel row follows. Only these
-- texts change, in the events made from the template (theme IMPARABLES).
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      -- The host: the same photo and Instagram, the new line.
      WHEN b.block ->> 'type' = 'card' AND (b.block ->> 'title' = 'Heidy Aristizábal' OR b.block ->> 'eyebrow' ILIKE 'Maestra de ceremonias')
      THEN b.block || jsonb_build_object(
        'eyebrow', 'Maestra de ceremonias',
        'title', 'Heidy Aristizábal',
        'html', '<p>@hlacosedora</p><p>Empezó haciendo uñas en un puesto alquilado. Hoy es cofundadora de H La Cosedora, Nail Fest y Guerra de Pinceles, tiene un récord Guinness y pasó por Shark Tank. Más de 10 años impulsando a la comunidad de uñas.</p>')
      -- The panel's card.
      WHEN b.block ->> 'type' = 'card' AND COALESCE(b.block ->> 'imageUrl', '') = '' AND (b.block ->> 'eyebrow' ILIKE 'Panel%' OR b.block ->> 'title' = 'Dinero sin tabú')
      THEN b.block || jsonb_build_object(
        'eyebrow', 'Panel · Lunes 28 · 12:05 p. m.',
        'title', 'El día que decidí cambiar',
        'html', '<p>Cuatro manicuristas cuentan la decisión que transformó su negocio y su vida.</p><p><em>Su antes, el momento del quiebre, su después y el consejo que te darían hoy.</em></p>')
      -- The panelists: each made-up one, in order, becomes the next story still to be announced.
      WHEN b.block ->> 'type' = 'people' AND jsonb_typeof(b.block -> 'items') = 'array' THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(b.block -> 'items') AS p(item)
          WHERE p.item ->> 'name' IN ('Valentina Ríos', 'Daniela Herrera', 'Carolina Méndez', 'Natalia Gómez')
        )
        THEN jsonb_set(b.block, '{items}', COALESCE((
          SELECT jsonb_agg(
            CASE WHEN x.example THEN jsonb_build_object(
              'name', '',
              'handle', '',
              'tag', COALESCE((ARRAY['La que dejó de cobrar barato', 'La que pasó de su casa a su propio local', 'La que salió de deudas y ordenó su plata', 'La que volvió a empezar desde cero'])[x.k], ''),
              'photoUrl', '',
              'tone', COALESCE(x.item ->> 'tone', 'pink'))
            ELSE x.item END
            ORDER BY x.n)
          FROM (
            SELECT i.item, i.n, y.example, row_number() OVER (PARTITION BY y.example ORDER BY i.n) AS k
            FROM jsonb_array_elements(b.block -> 'items') WITH ORDINALITY AS i(item, n)
            CROSS JOIN LATERAL (
              SELECT COALESCE(i.item ->> 'name' IN ('Valentina Ríos', 'Daniela Herrera', 'Carolina Méndez', 'Natalia Gómez'), false) AS example
            ) AS y
          ) AS x
        ), '[]'::jsonb))
        ELSE b.block END
      -- The program's panel row.
      WHEN b.block ->> 'type' = 'agenda' AND jsonb_typeof(b.block -> 'rows') = 'array' THEN jsonb_set(b.block, '{rows}', COALESCE((
        SELECT jsonb_agg(
          CASE WHEN COALESCE(r.line ->> 'kind', 'session') = 'session' AND COALESCE(r.line ->> 'instructor', '') = '' AND r.line ->> 'topic' ILIKE 'Panel%'
          THEN r.line || jsonb_build_object('topic', 'Panel «El día que decidí cambiar»', 'text', 'Cuatro historias reales de transformación')
          ELSE r.line END
          ORDER BY r.n)
        FROM jsonb_array_elements(b.block -> 'rows') WITH ORDINALITY AS r(line, n)
      ), '[]'::jsonb))
      ELSE b.block
    END
    ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
-- Nothing here may fail on a page saved some other way: only lists of blocks.
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
