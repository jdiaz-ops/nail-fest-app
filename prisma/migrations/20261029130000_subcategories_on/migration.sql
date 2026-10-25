-- The subcategories (Navidad, Halloween…) shown to everyone: the team said
-- yes on 2026-10-25. Editar El Taller → Textos y secciones can switch them off.
UPDATE "LibrarySettings"
SET "sections" = (CASE WHEN jsonb_typeof("sections") = 'object' THEN "sections" ELSE '{}'::jsonb END) || '{"subcategories": true}'::jsonb;
