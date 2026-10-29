-- Manicuristas Imparables (the team, 2026-10-29): «Conferencistas» leaves the
-- top of the speakers' section too — the cards come right under «¿Qué tienen
-- en común todos los conferencistas?». Only where it still reads so.
UPDATE "Event"
SET "landingBlocks" = replace("landingBlocks"::text, to_jsonb('Conferencistas'::text)::text, '""')::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
