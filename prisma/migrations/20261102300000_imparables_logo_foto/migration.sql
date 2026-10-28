-- Manicuristas Imparables (the team, 2026-10-28): «Mentalidad · Dinero ·
-- Marketing» joins the name, in spaced capitals under «Imparables»; the
-- group photo comes back to the cover, with no names under it — its caption
-- says who is in it again, for those who can't see it. Only where the texts
-- still read as the previous version left them.
UPDATE "Event" SET "subtitle" = '<p>Mentalidad · Dinero · Marketing</p><p>Deja de pensar en pequeño.</p><p>En 2 días aprende de quienes empezaron desde abajo, con miedos, y hoy tienen el negocio y la vida que sueñas: <strong>cómo lo hicieron y sus estrategias para ganar</strong>.</p>' WHERE "theme" = 'IMPARABLES' AND "subtitle" = '<p>Deja de pensar en pequeño.</p><p>En 2 días aprende de quienes empezaron desde abajo, con miedos, y hoy tienen el negocio y la vida que sueñas: <strong>cómo lo hicieron y sus estrategias para ganar</strong>.</p>';

UPDATE "Event"
SET "landingBlocks" = (replace("landingBlocks"::text,
      to_jsonb('Jimena, Pau, Cris, Alejandro, Karen, Fabi, Juan Tenorio, Oskar'::text)::text, to_jsonb('Jimena Montalban, Paula Chacón, Cristina Sierra, Alejandro Salinas, Fabi Pinillo Martínez, Juan Tenorio, Oskar Garzón, Maria Carolina Sebastia Sandoval y Heidy Aristizábal'::text)::text))::jsonb
WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array';
