-- Manicuristas Imparables' cover tagline (the team, 2026-10-31): under the
-- name, the headline comes back over the line, and both say the speakers'
-- story —
--   «Empezaron desde abajo, con tus mismos miedos. Hoy tienen el negocio que sueñas.»
--   «Aprende cómo lo hicieron y replica sus estrategias para ganar.» (bold: in bronze)
-- The pillars («Mentalidad · Dinero · Marketing», the first paragraph, told
-- under the group photo) stay as each event has them.
UPDATE "Event"
SET "subtitle" =
  CASE
    WHEN "subtitle" ~ '^<p>[^<]*·[^<]*</p>' THEN substring("subtitle" from '^<p>[^<]*·[^<]*</p>')
    ELSE '<p>Mentalidad · Dinero · Marketing</p>'
  END
  || '<p>Empezaron desde abajo, con tus mismos miedos. Hoy tienen el negocio que sueñas.</p>'
  || '<p><strong>Aprende cómo lo hicieron y replica sus estrategias para ganar.</strong></p>'
WHERE "theme" = 'IMPARABLES';
