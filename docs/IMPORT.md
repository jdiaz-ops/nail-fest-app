# Importar registros históricos (Ticket Tailor)

`/admin/import` sube el export "doorlist" de Ticket Tailor de un evento
(CSV) y lo convierte en Person + Registration + Consent en el CRM — sin
enviar correos, sin generar QR, sin eventos de Meta CAPI. Es solo para
poblar el CRM y las audiencias de Meta con datos que ya existen de eventos
pasados (o presentes, como Cali 2025/2026, Manizales, Armenia, Bogotá,
etc.), un evento a la vez.

## Cómo conseguir el archivo

En Ticket Tailor: tu evento → **Attendees** (o **Door list**) → **Export**.
Ese export trae, por ticket: nombre, tipo de boleta, código de ticket,
Order ID, check-in (Sí/No), email, teléfono, cédula/NIT, ciudad, profesión,
Instagram — las mismas preguntas del formulario de registro.

## Qué hace el import

1. **Todo el parsing pasa en tu navegador** (`lib/import/ticketTailorDoorlist.ts`)
   antes de enviar nada al servidor — puedes revisar el resumen (personas
   únicas, ciudades, profesiones, cuántos con asistencia real) antes de
   confirmar.
2. **Agrupa por email** — Ticket Tailor permite hasta 2 boletas por orden
   (titular + un acompañante), pero el acompañante nunca tiene datos
   propios: ambas filas traen el email/teléfono del titular. Agrupar por
   email es correcto, no solo dedup.
3. **"Asistió" (checkedIn)** = al menos una de las boletas de esa persona
   fue escaneada en la puerta. No es un headcount exacto (no se puede saber
   si fue el titular o el acompañante quien entró), pero es la mejor señal
   disponible y alimenta el filtro real "no asistió a X" en `/admin/segments`
   y `/admin/broadcasts` (`attended`, distinto de `event` que solo significa
   "se registró").
4. **Ciudad**: se recorta espacio y normaliza mayúsculas/minúsculas, pero
   NO se intenta fusionar variantes como "Pereira" con "Pereira Risaralda"
   — eso podría fusionar mal. Revisa el resumen antes de importar si eso te
   importa para un segmento específico.
5. **Profesión**: se mapea a las mismas 9 categorías reales del formulario
   (ver `src/lib/seed.ts`). Un valor no reconocido se importa tal cual como
   categoría nueva — no se descarta el dato.
6. **Cédula/NIT e Instagram**: se guardan en `Registration.customFields`,
   nunca se envían a Meta ni aparecen en correos.
7. **Consentimiento**: LOGISTICS siempre otorgado (implícito al registrarse).
   MARKETING/ADVERTISING son un checkbox en la pantalla de import — actívalos
   solo si el formulario original pedía consentimiento separado de
   marketing/publicidad (ver la decisión tomada para Pereira 2026: sí lo
   pedía, así que se importó como otorgado). WhatsApp no se importa — el
   canal no está activo todavía (ver `docs/WHATCHIMP_SETUP.md`).

## Seguro de correr dos veces

Si subes el mismo archivo (o una versión corregida) otra vez para el mismo
evento: los datos de `Person` se refrescan (upsert por email), pero NO se
duplica el `Registration` de alguien que ya estaba importado para ese
evento — se cuenta como "ya estaba" en el resultado, no como nuevo.

## Después de importar

El registro por sí solo no sincroniza nada con Meta. Para que estas
personas entren a una Custom Audience real:

1. Ve a `/admin/segments`.
2. Crea un segmento con el filtro que quieras (ej. `evento = pereira-2026`,
   o `asistió = pereira-2026` para solo quien fue de verdad).
3. El cron de `/api/meta/sync-audiences` lo sincroniza solo — ver
   `docs/DEPLOY.md`.
