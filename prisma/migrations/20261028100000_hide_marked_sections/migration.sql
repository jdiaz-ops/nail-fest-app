-- The parts the team marked to hide (2026-10-25): the menu's «Por nivel» and
-- the profile's «Ha estado en» switched off — the menu's «Registro gratis»
-- and the directory's search box are new switches, off already. Only
-- switched off: the team switches them back on in Editar biblioteca →
-- Textos y secciones.
UPDATE "LibrarySettings"
SET "sections" = (CASE WHEN jsonb_typeof("sections") = 'object' THEN "sections" ELSE '{}'::jsonb END) || '{"menuLevels": false, "appearances": false}'::jsonb;
