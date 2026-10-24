-- Cortos (2026-10-24): each video's topics ("Polygel", "Nail art"…), and the
-- ones an instructor picks when she sends one from her portal.
ALTER TABLE "LibraryVideo" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "InstructorVideoSubmission" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- "Shorties" is called "Cortos" now: the texts the admin had typed too
-- (the values only; the keys stay as they are).
UPDATE "LibrarySettings"
SET "texts" = (
  SELECT COALESCE(
    jsonb_object_agg(
      key,
      CASE
        WHEN jsonb_typeof(value) = 'string' THEN to_jsonb(
          regexp_replace(regexp_replace(regexp_replace(regexp_replace(value #>> '{}', 'Shorties', 'Cortos', 'g'), 'shorties', 'cortos', 'g'), 'Shortie', 'Corto', 'g'), 'shortie', 'corto', 'g')
        )
        ELSE value
      END
    ),
    '{}'::jsonb
  )
  FROM jsonb_each("texts")
)
WHERE jsonb_typeof("texts") = 'object';
