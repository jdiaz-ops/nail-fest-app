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
3. **Aforo real (`ticketCount` / `checkedInCount`)** — cada registro guarda
   cuántas boletas tenía esa persona (1 o 2: titular + acompañante) y
   cuántas de esas boletas específicas fueron escaneadas ("Checked-in: Yes"
   por fila del CSV, contado boleta por boleta — nunca se asume que si
   escanearon al titular también entró el acompañante). `SUM(checkedInCount)`
   de un evento es el aforo real que entró por la puerta, comparable al
   "Checked in" que muestra Ticket Tailor — ver la tabla de aforo en
   `/admin/registrations`. `checkedInCount > 0` a nivel de persona alimenta
   el filtro `attended` ("no asistió a X") en `/admin/segments` y
   `/admin/broadcasts`, distinto de `event` que solo significa "se
   registró" sin importar si fue.

   **Límite real, no de esta app**: esto es un snapshot (boleta escaneada
   sí/no), no un log de reingresos — Ticket Tailor no registra cuántas
   veces se escaneó cada boleta ni cuándo, solo si se escaneó alguna vez.
   Reingreso de verdad (titular entra sábado, sale, vuelve domingo) solo
   se podrá trackear con la futura app de escaneo propia, que si va a
   guardar cada escaneo como su propio evento con fecha/hora.
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

Si subes el mismo archivo (o una versión corregida, ej. con datos de
check-in actualizados) otra vez para el mismo evento: `Person` y
`Registration` se actualizan en el lugar (upsert por email, y por
persona+evento respectivamente) — nunca se duplica un registro. El
resultado distingue `created` (gente nueva) de `updated` (ya existía, se
refrescaron sus datos). El consentimiento SÍ es a prueba de duplicados
distinto: solo se registra una vez, la primera vez que esa persona entra a
ese evento — una segunda corrida no vuelve a insertar filas de
consentimiento.

## Después de importar

El registro por sí solo no sincroniza nada con Meta. Para que estas
personas entren a una Custom Audience real:

1. Ve a `/admin/segments`.
2. Crea un segmento con el filtro que quieras (ej. `evento = pereira-2026`,
   o `asistió = pereira-2026` para solo quien fue de verdad).
3. El cron de `/api/meta/sync-audiences` lo sincroniza solo — ver
   `docs/DEPLOY.md`.
