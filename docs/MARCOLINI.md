# Marcolini — contexto para las sesiones de Nail Fest

Juan (Jean Díaz) habla de Marcolini todo el tiempo mientras trabajamos en
Nail Fest. Este documento guarda lo que hay que saber del proyecto para no
tener que volver a explorarlo. Se escribió el 2026-10-19 leyendo el repo
**sin tocarlo**; si algo de acá choca con el código actual, manda el código.

> Regla de estas sesiones: Marcolini se lee, no se modifica, salvo que Juan
> lo pida explícitamente. Todo el trabajo del día a día es en
> `jdiaz-ops/nail-fest-app` (rama `main`).

## Qué es

Marcolini es la plataforma de **creator commerce** de Juan en Colombia:
conecta **marcas** con **creadoras de contenido** (el primer vertical es el
mundo de las uñas, el mismo público de Nail Fest). La creadora recibe un
**código de descuento** propio por cada marca, lo comparte con su audiencia,
y cada venta que entra con ese código le genera una **comisión**. Marcolini
cobra una tarifa a la marca. Además, las marcas pueden montar su tienda
dentro de Marcolini ("Mi tienda") con su propia pasarela de pago: el dinero
de las ventas nunca pasa por Marcolini.

Frase propia del proyecto (2026-10-01): "Marcolini se enfoca 100 % en lo
esencial (códigos, comisiones, pagos y tienda) y las funciones se irán
sumando poco a poco".

## Dónde vive

| Cosa | Valor |
| --- | --- |
| Repo | `jdiaz-ops/test1234` (el nombre es un accidente; el proyecto es Marcolini) |
| Rama de producción | `claude/me-escuchas-ucxsdc` (es la rama por defecto; **no existe `main`**) |
| Último commit visto | `b713c19` "Productos en el celular: tarjetas sin deslizar y «Precio de promoción»" |
| Dominio | `marcolini.lat` (Vercel, deploy automático de la rama) |
| Tiendas de marca | `{slug}.marcolini.lat` y también `marcolini.lat/t/{slug}` |
| Vitrina de creadora | `{slug}.marcolini.lat` o `marcolini.lat/c/{slug}` (ej. "Nail Fest" → `nailfest.marcolini.lat`) |
| Link de aliado | `marcolini.lat/unete/{code}` |
| Landings públicas | `/`, `/para-creadores`, `/para-marcas`, `/terminos`, `/privacidad` |

Ojo: en estas sesiones el checkout local `/home/user/test1234` está viejo
(commit `8ff7fe2`, 15 de septiembre, cientos de commits atrás). Para leer el
código real: `git fetch origin claude/me-escuchas-ucxsdc` y exportar esa
rama con `git archive` a una carpeta del scratchpad. `docs/cambiar-dominio.md`
del repo también está desactualizado (dice que la app vive en
`test1234-five-beta.vercel.app`).

## Stack

- Next.js 16.3.2 (App Router) + React 19.2.8 + Tailwind 4. Es una versión
  con cambios respecto a lo que uno conoce; el repo pide leer
  `node_modules/next/dist/docs/` antes de escribir código.
- Prisma 6 + Postgres. Build en Vercel: `node scripts/migrate-deploy.mjs && next build`.
- Auth.js v5 (beta) con sesión **JWT** (decisión para que una app móvil
  futura use el mismo backend). Inicio de sesión con Google también.
- Resend (correo), Vercel Blob (imágenes), `@anthropic-ai/sdk` (organizador
  de tienda con IA, copy de inicio con IA), Tiptap (editor), dnd-kit,
  exceljs/papaparse (importaciones), pdf-lib/pdfjs, vitest + Playwright.
- Toda la lógica de negocio vive en `src/server/services/*` (más de 100
  servicios); las páginas llaman rutas de `src/app/api/**`. Nunca lógica de
  negocio dentro de componentes. Esto es para que la futura app móvil
  (React Native vía Expo, aún no se construye) reutilice todo. Ya existe el
  modelo `DeviceToken` para push, sin usar.
- Crons de Vercel (hora UTC): `pagos-diarios` 09:00, `sincronizar-productos`
  06:00, `reordenar-tiendas` 05:00.
- Comentarios del código, docs y UI en español.

## Los cuatro portales

| Portal | Ruta | Quién |
| --- | --- | --- |
| Portal Marca | `/marca` | La marca: ofertas, creadoras inscritas, Mi tienda, pedidos, cortes y pagos a Marcolini, muestras, PR boxes, mensajes. |
| Portal Creador | `/creador` | La creadora: códigos por marca, ventas y comisiones, pagos, vitrina pública, muestras. |
| Panel Admin | `/admin` | Juan y su equipo (roles OWNER/FINANCE y otros `AdminRole`): finanzas, cortes, fraude, configuración, marcas, creadoras, equipo. |
| Portal Aliado | `/aliado` | Aliados comerciales que traen marcas y creadoras; entran sin contraseña, con un link al correo. |

## Cómo funciona el dinero

**Códigos y comisiones (modelo Awin).** Cada marca crea una **Offer** con
`defaultCommissionPercent` (lo que gana la creadora) y
`defaultDiscountPercent` (el descuento del comprador), con `joinMode`
OPEN o APPROVAL. Al inscribirse, la creadora recibe su `discountCode`
(`CreatorOfferEnrollment`). Una venta atribuida crea una **Transaction**
(fuente: webhook de Shopify/WooCommerce, registro manual, o pedido de Mi
tienda) y el motor de comisiones (`commission-service.ts`) crea la
**Commission**: la comisión de la creadora va completa para ella y la
tarifa de Marcolini se cobra aparte a la marca. También avisa a la
creadora y a los admins, y revisa fraude.

**Tarifa de Marcolini en Mi tienda.** Desde el 2026-10-17 la tarifa se
cobra sobre **toda** venta pagada en Mi tienda, con o sin código. Con
código va dentro de la Commission; sin código queda en `StoreSaleFee`.
Base: productos ya con descuento, sin envío. Las dos entran al corte
mensual.

**Reglas en `PlatformConfig` (editable desde el Panel Admin):**

| Regla | Valor por defecto |
| --- | --- |
| Tarifa de Marcolini | 5 % (la marca puede tener un override) |
| IVA sobre la tarifa | 0 % desde el 2026-10-17 (Juan factura como persona natural) |
| Día del corte a las marcas | 1 de cada mes |
| Día de pago a creadoras | 15 de cada mes |
| Retención por devoluciones | 15 días |
| Pago inmediato a creadora | 5 % de cargo |
| Licencias de contenido | Marcolini retiene 20 % del fee |
| Plazo para pagar el corte (Nivel 1 → 2) | 72 horas hábiles colombianas |
| Plazo antes de desactivar (Nivel 2 → 3) | 72 horas hábiles más |

**Cortes a las marcas (`BrandCharge`).** El día 1 se genera el corte con
aviso de cobro en PDF, instrucciones de pago (texto libre + QR, desde el
admin) y fecha límite fija. La marca sube el comprobante y un admin lo
verifica. Recordatorios a 48 h y 24 h. Sin comprobante verificado: Nivel 2
(marca inhabilitada temporalmente) y luego Nivel 3 (desaparece del
marketplace y sus códigos dejan de atribuir ventas).

**Aliados (`AllyProfile`).** El admin los crea; cada aliado tiene su link
`marcolini.lat/unete/{code}` donde marcas y creadoras dejan una solicitud
(`AllyLead`); Marcolini la vincula (`AllyReferral`) y el aliado gana
2,5 % de lo que vendan las marcas que trajo y 1,25 % de lo de las
creadoras, durante 6 meses desde la primera venta (los porcentajes se
copian a cada referido para no cambiar lo ya acordado). Solo ve nombres y
totales por mes, nunca pedidos ni clientes.

## Mi tienda y las integraciones

- **Pasarelas** (`PaymentProvider`): Wompi, Mercado Pago, PayU, ePayco y
  Bold, cada marca con sus propias credenciales y modo TEST/LIVE. Hay
  compras de prueba que nunca generan tarifa.
- **Importar una tienda**: desde Shopify (CSV, colecciones, páginas,
  secciones, diseño, envíos), WooCommerce, Ecometri u otra tienda, con
  "Duplicar tienda", un organizador con IA, familias de color y productos
  hermanos. Hay plantillas de vitrina, menús, colecciones, zonas de envío,
  stock, clientes, pedidos con estados de cumplimiento y envíos.
- **Conexión Shopify/WooCommerce en vivo** (webhooks de ventas): el código
  existe pero está escondido porque la app de Shopify no está aprobada.
- **Dataico** (facturación electrónica): solo para `hlacosedora`, la tienda
  de **H la Cosedora, la marca de Juan**. Las demás tiendas no la ven.
- **Pixels**: Meta, TikTok y GA4 por tienda.
- **Dominio propio** por tienda: escondido; todas van en `{slug}.marcolini.lat`.
- Listas de espera (`Waitlist`) de creadoras y marcas desde las landings.

## Funciones y en qué estado están (`src/lib/features.ts`)

Los interruptores son variables `NEXT_PUBLIC_FEATURE_*` en Vercel (requieren
redeploy). Nada se borra al apagar; solo deja de verse.

| Función | Estado | Fecha / motivo |
| --- | --- | --- |
| Muestras (la marca regala producto a creadoras) | **Encendida** para todas | 2026-10-17, lo pidió una marca en la presentación |
| Productos físicos solamente (sin SERVICE/DIGITAL al crear) | Encendida la restricción | 2026-10-19 |
| Reseñas de productos | Apagada | La marca pidió quitarla (2026-10-01) |
| Conexión Shopify/WooCommerce | Apagada | App de Shopify sin aprobar (2026-10-01) |
| Dominio propio | Apagada | 2026-10-01 |
| Campañas y misiones (Misión, Flash Sale, Mix) | Apagada | Enfoque en lo esencial (2026-10-01) |
| Invita y gana (referidos entre creadoras, bono de $20.000) | Apagada | "el bono de 20.000 no va por ahora" (2026-10-19) |
| Buzón de sugerencias (mensaje o nota de voz) | Pausada | "pausa el buzón" (2026-10-19) |
| Dataico | Solo `hlacosedora` | 2026-10-04 |

Otras piezas que existen en el código: PR boxes (cajas de producto para
creadoras), licencias de contenido y contenido pagado por la marca,
mensajería marca-creadora, notificaciones internas y difusiones
(broadcasts), insignias y puntaje de creadora, directorio y marketplace de
marcas, banderas de fraude, exportaciones de tienda, go-live por tienda.

## Documentos internos del repo

- `ARCHITECTURE.md`: por qué JWT, capa de servicios y plan de app móvil.
- `DEPLOY.md`: despliegue en Vercel.
- `docs/landings-guardadas.md`: versiones de las landings que Juan pidió
  guardar (la general del 3 de octubre de 2026, commit `7bc4328`).
- `docs/propuestas/README.md`: borradores sin aprobar (vacío por ahora).
- `docs/cambiar-dominio.md`: pasos al cambiar de dominio (desactualizado).

## Línea de tiempo reciente (para seguirle el hilo a Juan)

- 2026-10-01: se esconden reseñas, conexión Shopify, dominio propio,
  campañas y referidos. Enfoque en códigos, comisiones, pagos y tienda.
- 2026-10-03: se publican las landings de uñas (creadoras y marcas).
- 2026-10-04: facturación Dataico a la medida para H la Cosedora.
- 2026-10-17: muestras encendidas para todas las marcas; IVA de la tarifa a
  0; tarifa sobre toda venta de Mi tienda, con o sin código.
- 2026-10-19: solo productos físicos; bono de referidos no va; buzón de
  sugerencias pausado; mejoras de productos en el celular.

## Relación con Nail Fest

- Mismo público (uñas, Colombia) y mismo dueño. Nail Fest es el evento y la
  comunidad; Marcolini es el canal de venta todo el año.
- En Marcolini, "Nail Fest" aparece como ejemplo de vitrina de creadora
  (`nailfest.marcolini.lat`): la idea es que Nail Fest pueda ser una
  creadora o aliado dentro de Marcolini.
- Estrategia conversada el 2026-10-19 para monetizar las marcas de Nail Fest
  (envíos patrocinados, códigos exclusivos con comisión, tienda o drops de
  Nail Fest, membresía anual, club de fidelidad, masterclasses de pago): la
  cuponera de marcas y la comisión por ventas se parquearon hasta que
  Marcolini esté activo con marcas reales, porque Marcolini ya resuelve
  códigos, atribución y comisiones.
- No hay integración técnica entre los dos repos hoy. Si algún día se
  conecta algo, lo natural es que Nail Fest consuma rutas de
  `src/app/api/**` de Marcolini (la capa pensada para clientes externos).

## Glosario rápido

- **Oferta (Offer)**: el programa de una marca (comisión, descuento, modo de ingreso).
- **Inscripción (Enrollment)**: una creadora dentro de una oferta, con su código.
- **Corte (BrandCharge)**: la cuenta mensual que la marca le paga a Marcolini.
- **Nivel 1 / 2 / 3**: corte pendiente / marca inhabilitada / servicio desactivado.
- **Mi tienda**: la tienda de la marca dentro de Marcolini con su pasarela.
- **Vitrina**: la página pública de una creadora.
- **Aliado**: quien trae marcas o creadoras y gana un porcentaje por 6 meses.
- **Muestras / PR box**: producto que la marca envía a creadoras.
