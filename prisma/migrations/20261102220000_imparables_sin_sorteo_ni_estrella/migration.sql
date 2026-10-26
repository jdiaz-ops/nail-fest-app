-- Manicuristas Imparables (the team, 2026-10-26): no raffle on Sunday's
-- closing and no next edition's announcement on Monday's; the panel without
-- the «Charla estrella» tag; Paula's card tells more of her story (the chain
-- of 7 spas stays). Each change only where the page still reads as the
-- previous version left it.
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(b.block) <> 'object' THEN b.block
      WHEN b.block ->> 'type' = 'agenda' AND jsonb_typeof(b.block -> 'rows') = 'array' THEN jsonb_set(b.block, '{rows}', (
        SELECT coalesce(jsonb_agg(
          CASE
            WHEN jsonb_typeof(r.row) <> 'object' THEN r.row
            WHEN r.row ->> 'topic' = 'Cierre del día y sorteo' THEN jsonb_set(r.row, '{topic}', '"Cierre del día"')
            WHEN r.row ->> 'topic' = 'Agradecimientos y anuncio de la próxima edición' THEN jsonb_set(r.row, '{topic}', '"Agradecimientos"')
            WHEN r.row ->> 'topic' = 'Panel «El día que decidí cambiar»' AND r.row ->> 'label' = 'Charla estrella' THEN jsonb_set(r.row, '{label}', '""')
            ELSE r.row
          END ORDER BY r.n), '[]'::jsonb)
        FROM jsonb_array_elements(b.block -> 'rows') WITH ORDINALITY AS r(row, n)))
      WHEN b.block ->> 'type' = 'people' AND jsonb_typeof(b.block -> 'items') = 'array' THEN jsonb_set(b.block, '{items}', (
        SELECT coalesce(jsonb_agg(
          CASE
            WHEN jsonb_typeof(p.item) = 'object' AND lower(p.item ->> 'handle') = '@soypauc_tuprofe'
                 AND p.item ->> 'tag' = 'De la mesa a CEO de El Imperio de las Uñas, una cadena de 7 spas. Los miedos que tuvo que vencer: cobrar sin culpa y armar un equipo.'
              THEN jsonb_set(p.item, '{tag}', to_jsonb('Empezó atendiendo en una mesa de manicure y hoy es CEO de El Imperio de las Uñas, una cadena de 7 spas. Para crecer tuvo que vencer el autosabotaje, cobrar sin culpa y aprender a delegar en un equipo.'::text))
            ELSE p.item
          END ORDER BY p.n), '[]'::jsonb)
        FROM jsonb_array_elements(b.block -> 'items') WITH ORDINALITY AS p(item, n)))
      ELSE b.block
    END ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
