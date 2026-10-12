# Reseñas

Las asistentes califican un evento (1 a 5 estrellas, comentario, hasta tres
fotos) desde su enlace personal `/resena/<token>`. El token es el mismo
`qrToken` firmado de su entrada, así que el enlace no necesita clave.

Reglas fijas (lib/reviews.ts):

- Solo puede reseñar quien fue **escaneada en puerta** (`checkedInCount > 0`
  o un scan válido). Una reseña por inscripción.
- Nada se publica sin aprobación en `/admin/events/<id>/resenas`.
- Con la casilla de permiso, la reseña se muestra con nombre (primer nombre
  e inicial del apellido), ciudad, @ de Instagram y fotos. Sin la casilla,
  cuenta en el promedio pero no se muestra. El permiso se guarda con fecha.
- Quien reseña recibe la etiqueta `acceso anticipado` (para segmentar la
  preventa de la siguiente edición).

## Cómo pedirla (la app no envía nada sola)

- **WhatsApp:** plantilla en Meta con un botón de URL que termine en
  `{{1}}`, por ejemplo `https://nailfest.lat/resena/{{1}}`. Enviada desde
  Difusiones a un segmento "asistió a <evento>" con el evento elegido, la
  app rellena el botón con el token de cada persona (mismo mecanismo que
  "Ver mi entrada").
- **Correo del evento:** marcar "Solo a quienes asistieron" y usar
  "Insertar enlace de reseña" (`{{LINK_RESENA}}`).

## Dónde se ve

- Bloque de landing "Reseñas" (editor de bloques): este evento, la edición
  anterior en la misma ciudad, o todas las ediciones. No se muestra con
  menos de 3 reseñas aprobadas.
- Home (`/admin/homepage`): bloque completo, solo la insignia, o nada; debajo
  del hero o antes de las marcas. Mismo mínimo.
- Insignia (`components/reviews/ReviewsBadge.tsx`): estrellas, promedio y
  número de reseñas, enlaza a `/resenas`. También como bloque de landing
  ("Insignia de reseñas") y en nailfest.lat/links (`/admin/links`).
- `/resenas`: todas las aprobadas con permiso, con filtro por ciudad.
- Tarjeta para historia de Instagram (PNG 1080×1920) desde la pantalla de
  gracias y desde el admin.

## Sorteo

Por evento: N premios (3 por defecto) entre las reseñas que marcaron
participar antes del cierre (7 días después del evento por defecto). El
sorteo se hace una sola vez, con semilla guardada (acta) y suplentes; la
app prepara el mensaje de WhatsApp para cada ganadora pero no lo envía.
