-- Manicuristas Imparables (the team, 2026-10-26): Karen's card said her
-- talk's title twice, once in her line and again right under it as the
-- title; her line keeps only who she is. Only where it still reads as the
-- previous version left it.
UPDATE "Event" AS e
SET "landingBlocks" = (
  SELECT jsonb_agg(
    CASE
      WHEN jsonb_typeof(b.block) = 'object' AND b.block ->> 'type' = 'people' AND jsonb_typeof(b.block -> 'items') = 'array' THEN jsonb_set(b.block, '{items}', (
        SELECT coalesce(jsonb_agg(
          CASE
            WHEN jsonb_typeof(p.item) = 'object' AND lower(p.item ->> 'handle') = '@karenw.trainer'
                 AND p.item ->> 'tag' = 'Creadora del Método Esencia. Tu esencia es tu marca: deja de copiar y crea tu sello.'
              THEN jsonb_set(p.item, '{tag}', '"Creadora del Método Esencia."')
            ELSE p.item
          END ORDER BY p.n), '[]'::jsonb)
        FROM jsonb_array_elements(b.block -> 'items') WITH ORDINALITY AS p(item, n)))
      ELSE b.block
    END ORDER BY b.n)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS b(block, n)
)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
