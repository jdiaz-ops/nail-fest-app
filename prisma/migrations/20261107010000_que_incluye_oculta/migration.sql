-- Manicuristas Imparables (the team, 2026-11-03: «esconde»): «Qué incluye tu cupo» — the section whose heading is
-- «Todo lo que trae tu boleta» — is hidden: its heading and every block under it, up to the next heading, as they
-- are, so nothing is lost and the team can show it again from the page's editor. «Boleta Imparable» says what the
-- ticket brings now (components/imparables/ImpBoleta.tsx). Blocks already hidden stay as they are.
DO $$
DECLARE
  ev record;
  b jsonb;
  inside boolean;
  result jsonb;
BEGIN
  FOR ev IN SELECT "id", "landingBlocks" FROM "Event" WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' LOOP
    result := '[]'::jsonb;
    inside := false;
    FOR b IN SELECT t.value FROM jsonb_array_elements(ev."landingBlocks") WITH ORDINALITY AS t(value, n) ORDER BY t.n LOOP
      IF jsonb_typeof(b) = 'object' AND b->>'type' = 'heading' THEN
        inside := lower(btrim(coalesce(b->>'title', ''))) = 'todo lo que trae tu boleta';
      END IF;
      IF inside AND jsonb_typeof(b) = 'object' AND (b->'hidden') IS DISTINCT FROM 'true'::jsonb THEN
        b := b || '{"hidden": true}'::jsonb;
      END IF;
      result := result || jsonb_build_array(b);
    END LOOP;
    IF result IS DISTINCT FROM ev."landingBlocks" THEN
      UPDATE "Event" SET "landingBlocks" = result WHERE "id" = ev."id";
    END IF;
  END LOOP;
END $$;
