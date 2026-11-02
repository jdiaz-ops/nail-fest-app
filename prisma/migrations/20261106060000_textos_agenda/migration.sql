-- Manicuristas Imparables (the team, 2026-11-02): two lines of the program as the team rewrote them. The morning's:
-- «historias», no longer counted (no «tres»), and «el día en que casi lo dejan todo». Paula Chacón's talk: «Los miedos
-- que tuvo que vencer y retos que superar». Wherever the page has them word for word; anything already rewritten stays
-- as it is. (The code's own copies: lib/imparables/transformacion.ts and template.ts.)
UPDATE "Event"
SET "landingBlocks" = replace(
      replace(
        "landingBlocks"::text,
        'Vas a escuchar tres historias que se parecen a la tuya: el día en que casi lo dejan, la mesa alquilada, el miedo a cobrar.',
        'Vas a escuchar historias que se parecen a la tuya: el día en que casi lo dejan todo, la mesa alquilada, el miedo a cobrar.'
      ),
      'Los miedos que tuvo que vencer: cobrar sin culpa, delegar y armar un equipo.',
      'Los miedos que tuvo que vencer y retos que superar: cobrar sin culpa, delegar y armar un equipo.'
    )::jsonb
WHERE theme = 'IMPARABLES'
  AND jsonb_typeof("landingBlocks") = 'array'
  AND (
    "landingBlocks"::text LIKE '%Vas a escuchar tres historias que se parecen a la tuya: el día en que casi lo dejan, la mesa alquilada, el miedo a cobrar.%'
    OR "landingBlocks"::text LIKE '%Los miedos que tuvo que vencer: cobrar sin culpa, delegar y armar un equipo.%'
  );
