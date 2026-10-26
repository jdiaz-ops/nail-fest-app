-- Manicuristas Imparables, the team's batch of changes (2026-10-26), on the
-- events made from the template, each one only where the page still reads
-- as the template left it:
--  · the speakers by their full names (cards, program, results, doubts);
--  · Jimena Montalban's talk «Tu nombre también puede ser una marca» and
--    Cristina Sierra's «La historia de superación detrás de 10 sedes»;
--  · the program titled «Así son los dos días», its first day «Tu talento
--    vale más» (for every manicurist, not only those who want a brand), no
--    talk singled out as the star, and both closings just «Cierre»;
--  · «¿Es para ti?» hidden (kept in the editor, like «Por qué ahora»);
--  · no «IVA del 19% incluido» under the price;
--  · the doubts without the label over their title or in their cards;
--  · the questions no longer promising each visitor's own hour.
DO $$
DECLARE
  names CONSTANT jsonb := '{"Jimena": "Jimena Montalban", "Pau": "Paula Chacón", "Cris Sierra": "Cristina Sierra", "Maris": "Maria Carolina Sebastia Sandoval", "Fabi": "Fabi Pinillo Martínez", "Oskar": "Oskar Garzón"}';
  talks CONSTANT jsonb := '{"De la mesa a una marca internacional": "Tu nombre también puede ser una marca", "La historia detrás de 10 sedes": "La historia de superación detrás de 10 sedes"}';
  topics CONSTANT jsonb := '{"De la mesa a empresaria": "Tu talento vale más", "Cierre y sorteo": "Cierre", "Cierre y anuncio de la próxima edición": "Cierre"}';
  takeaways CONSTANT jsonb := '{"cuánto cobrar sin culpa y el camino para pasar de la mesa a tu propia marca.": "cuánto cobrar sin culpa y cómo hacer que tu trabajo te deje más dinero."}';
  whos CONSTANT jsonb := '{"Fabi, Alejandro Salinas y Oskar": "Fabi Pinillo Martínez, Alejandro Salinas y Oskar Garzón", "Juan Tenorio, Pau y el panel": "Juan Tenorio, Paula Chacón y el panel", "Jimena, Cris Sierra y Maris": "Jimena Montalban, Cristina Sierra y Maria Carolina Sebastia Sandoval", "Pau": "Paula Chacón", "Maris": "Maria Carolina Sebastia Sandoval"}';
  notes CONSTANT jsonb := '{"Pau empezó en una mesa de manicure y hoy es CEO de El Imperio de las Uñas.": "Paula empezó en una mesa de manicure y hoy es CEO de El Imperio de las Uñas.", "Maris empezó desde nada y hoy forma educadoras en Chile.": "Maria Carolina empezó desde nada y hoy forma educadoras en Chile."}';
  abroad CONSTANT text := 'Sí. Es 100% en vivo por Zoom, así que lo ves desde cualquier país. Las horas de la agenda están en hora Colombia y debajo te mostramos la de tu ciudad. Si necesitas ayuda para pagar desde afuera, escríbenos por WhatsApp.';
  ev record;
  blk jsonb;
  item jsonb;
  items jsonb;
  result jsonb;
  hiding boolean;
BEGIN
  FOR ev IN SELECT "id", "landingBlocks" AS blocks FROM "Event" WHERE "theme" = 'IMPARABLES' AND jsonb_typeof("landingBlocks") = 'array' LOOP
    result := '[]'::jsonb;
    hiding := false;
    FOR blk IN SELECT x.value FROM jsonb_array_elements(ev.blocks) WITH ORDINALITY AS x(value, n) ORDER BY x.n LOOP
      IF jsonb_typeof(blk) = 'object' THEN
        CASE blk ->> 'type'
          WHEN 'heading' THEN
            -- «¿Es para ti?» and the blocks under it, until the next title.
            hiding := coalesce(blk ->> 'title' = '¿Es para ti?', false);
            IF blk ->> 'eyebrow' = 'Agenda' AND blk ->> 'title' = 'Dos días que cambian tu negocio' THEN
              blk := blk || '{"title": "Así son los dos días"}';
            END IF;
            IF blk ->> 'eyebrow' = 'Si todavía dudas' THEN
              blk := blk || '{"eyebrow": ""}';
            END IF;
          WHEN 'people' THEN
            IF jsonb_typeof(blk -> 'items') = 'array' THEN
              items := '[]'::jsonb;
              FOR item IN SELECT x.value FROM jsonb_array_elements(blk -> 'items') WITH ORDINALITY AS x(value, n) ORDER BY x.n LOOP
                IF jsonb_typeof(item) = 'object' AND coalesce(names ? (item ->> 'name'), false) THEN
                  item := item || jsonb_build_object('name', names ->> (item ->> 'name'));
                END IF;
                items := items || jsonb_build_array(item);
              END LOOP;
              blk := jsonb_set(blk, '{items}', items);
            END IF;
          WHEN 'agenda' THEN
            IF jsonb_typeof(blk -> 'rows') = 'array' THEN
              items := '[]'::jsonb;
              FOR item IN SELECT x.value FROM jsonb_array_elements(blk -> 'rows') WITH ORDINALITY AS x(value, n) ORDER BY x.n LOOP
                IF jsonb_typeof(item) = 'object' THEN
                  IF coalesce(talks ? (item ->> 'topic'), false) THEN
                    item := item || jsonb_build_object('topic', talks ->> (item ->> 'topic'));
                  END IF;
                  IF coalesce(topics ? (item ->> 'topic'), false) THEN
                    item := item || jsonb_build_object('topic', topics ->> (item ->> 'topic'));
                  END IF;
                  IF coalesce(names ? (item ->> 'instructor'), false) THEN
                    item := item || jsonb_build_object('instructor', names ->> (item ->> 'instructor'));
                  END IF;
                  IF coalesce(takeaways ? (item ->> 'takeaway'), false) THEN
                    item := item || jsonb_build_object('takeaway', takeaways ->> (item ->> 'takeaway'));
                  END IF;
                  IF item ->> 'star' = 'true' THEN
                    item := item || '{"star": false}';
                  END IF;
                END IF;
                items := items || jsonb_build_array(item);
              END LOOP;
              blk := jsonb_set(blk, '{rows}', items);
            END IF;
          WHEN 'slides' THEN
            IF jsonb_typeof(blk -> 'items') = 'array' THEN
              items := '[]'::jsonb;
              FOR item IN SELECT x.value FROM jsonb_array_elements(blk -> 'items') WITH ORDINALITY AS x(value, n) ORDER BY x.n LOOP
                IF jsonb_typeof(item) = 'object' THEN
                  IF coalesce(whos ? (item ->> 'who'), false) THEN
                    item := item || jsonb_build_object('who', whos ->> (item ->> 'who'));
                  END IF;
                  IF coalesce(notes ? (item ->> 'note'), false) THEN
                    item := item || jsonb_build_object('note', notes ->> (item ->> 'note'));
                  END IF;
                  IF blk ->> 'style' = 'doubts' AND coalesce(item ->> 'noteLabel' IN ('Incluido', 'Prueba', 'Garantía'), false) THEN
                    item := item || '{"noteLabel": ""}';
                  END IF;
                END IF;
                items := items || jsonb_build_array(item);
              END LOOP;
              blk := jsonb_set(blk, '{items}', items);
            END IF;
          WHEN 'prices' THEN
            IF blk ->> 'note' = 'IVA del 19% incluido' THEN
              blk := blk || '{"note": ""}';
            END IF;
          WHEN 'faq' THEN
            IF jsonb_typeof(blk -> 'items') = 'array' THEN
              items := '[]'::jsonb;
              FOR item IN SELECT x.value FROM jsonb_array_elements(blk -> 'items') WITH ORDINALITY AS x(value, n) ORDER BY x.n LOOP
                IF jsonb_typeof(item) = 'object' AND item ->> 'answer' = abroad THEN
                  item := item || jsonb_build_object('answer', replace(abroad, ' y debajo te mostramos la de tu ciudad', ''));
                END IF;
                items := items || jsonb_build_array(item);
              END LOOP;
              blk := jsonb_set(blk, '{items}', items);
            END IF;
          ELSE
            NULL;
        END CASE;
        IF hiding THEN
          blk := blk || '{"hidden": true}';
        END IF;
      END IF;
      result := result || jsonb_build_array(blk);
    END LOOP;
    UPDATE "Event" SET "landingBlocks" = result WHERE "id" = ev."id";
  END LOOP;
END $$;
