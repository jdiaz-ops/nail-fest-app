# Plan B: Resend (si SES no responde o es rechazado)

Esto existe porque Amazon puede tardar en aprobar production access — o
negarlo — y mientras tanto la app necesita poder mandar correos reales.
**No reemplaza el setup de SES** (`SES_SETUP.md`): las dos cosas conviven
en el código a la vez, y cuál está realmente activa lo decide una sola
variable de entorno (`EMAIL_PROVIDER`). Mientras esa variable no exista,
todo sigue funcionando exactamente igual que antes de este archivo — nada
de esto toca el setup de Amazon.

## Por qué Resend

A diferencia de SES/Postmark/SendGrid, Resend no tiene una cola de
aprobación manual: verificas el dominio por DNS y ya puedes enviar, sin
esperar a que alguien revise la cuenta. Plan gratis: 3,000 correos/mes
(100/día). Plan Pro, USD 20/mes: 50,000 correos/mes, sin límite diario,
con overage de USD 0.90 por cada 1,000 extra si te pasas.

**Importante sobre transaccional vs. marketing en Resend**: esa
distinción en Resend es sobre qué endpoint de su API usas (`/emails` vs.
`/broadcasts`), no sobre el contenido — y `/broadcasts` exige tener a los
destinatarios cargados como "Contacts" en una "Audience" de Resend
primero. Esta app **nunca usa `/broadcasts`**: tanto los correos de
ticket (`sendTransactional`) como los broadcasts a segmentos
(`sendMarketing`) salen por `/emails`, porque el motor de segmentos/
broadcasts ya lo construimos nosotros mismos (`lib/broadcasts.ts`) y
usar además el de Resend sería una copia desconectada. Esto también
significa que **todo** lo que mandemos cae bajo el mismo cupo de
correos/mes del plan de Resend — nada nuestro toca su tabla de precios
de "Marketing" (que es por número de Contacts).

## 1. Cuenta y dominio

1. Crea una cuenta en Resend.
2. Dashboard → Domains → Add Domain → tu dominio (`nailfest.co` o el que
   uses para enviar).
3. Agrega los registros DNS que te da (SPF, DKIM, y opcionalmente DMARC)
   donde administras el dominio. La verificación suele tardar minutos, no
   días.

## 2. API key

Dashboard → API Keys → Create API Key. Permisos: "Sending access" alcanza
(no hace falta acceso de administrador de cuenta).

## 3. Variables de entorno

Agrégalas en Vercel (Project → Settings → Environment Variables) — no
actives `EMAIL_PROVIDER` todavía, eso es el paso 5:

```
RESEND_API_KEY=re_...
RESEND_FROM_TRANSACTIONAL=tickets@tudominio.com
RESEND_FROM_MARKETING=hola@tudominio.com
```

Mismos dos remitentes que ya usa SES (`SES_FROM_TRANSACTIONAL`/
`SES_FROM_MARKETING`) — usa las mismas direcciones si quieres, siempre y
cuando el dominio ya esté verificado en Resend (paso 1).

## 4. Webhook (tracking de entregas/aperturas/clics)

Igual de opcional que el de SES al principio (`EmailLog.status` se queda
en `SENT` sin esto, pero los correos igual se mandan) — hazlo cuando
tengas tiempo, no bloquea el Plan B en sí.

1. Genera un secreto para el token de verificación — Resend te lo da
   automáticamente al crear el webhook (paso 3 abajo), no lo inventas tú
   como con SES.
2. La URL del webhook: `https://tu-dominio.vercel.app/api/webhooks/resend`
3. Dashboard → Webhooks → Add Webhook → pega la URL de arriba → selecciona
   los eventos: `email.delivered`, `email.opened`, `email.clicked`,
   `email.bounced`, `email.complained`.
4. Resend te muestra un **Signing Secret** (`whsec_...`) al crear el
   webhook — cópialo a Vercel:
   ```
   RESEND_WEBHOOK_SECRET=whsec_...
   ```
5. A diferencia de SNS (SES), no hay paso de "confirmar suscripción" —
   Resend empieza a mandar eventos apenas guardas el webhook.

## 5. Activar Resend de verdad

Con los pasos 1-3 hechos (el 4 es opcional), una sola variable decide
cuál proveedor está activo:

```
EMAIL_PROVIDER=resend
```

Sin esta variable (o con cualquier otro valor), sigue mandando por SES —
este es el único interruptor real. Agrégala en Vercel y haz un redeploy
(o simplemente espera al próximo deploy — Vercel aplica env vars nuevas
en el siguiente build).

**Para volver a SES** más adelante (si Amazon aprueba production access
después de todo): borra esa variable o cámbiala a `EMAIL_PROVIDER=ses`, y
listo — nada más que tocar. El código de SES no se desinstaló ni se
modificó por tener Resend construido al lado.

## Qué NO cubre esto

- **Reputación de dominio aislada entre transaccional y marketing**: SES
  usa Configuration Sets separados para que una queja de spam en
  marketing no le pegue a la entrega de tickets. Resend no tiene un
  equivalente exacto si todo sale por `/emails` — mandamos cada canal
  desde un remitente distinto (`RESEND_FROM_TRANSACTIONAL` vs.
  `RESEND_FROM_MARKETING`), que es la práctica real que más importa para
  deliverability, pero no es lo mismo. Bajo riesgo al volumen que maneja
  esta app (~10k/evento, todo opt-in).
- **Firma real de eventos de SES** (`/api/webhooks/ses` sigue con el
  stopgap de token en la URL, no firma criptográfica) — sin cambios, eso
  es un tema aparte de SES en sí, no de este Plan B.
