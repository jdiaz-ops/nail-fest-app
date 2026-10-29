-- Prices by stage (Manicuristas Imparables, the team, 2026-10-29): a ticket
-- type can be a price stage — its name in code, how many it sells at its
-- price (paid purchases only; none: no cap), the words after its date on the
-- page, and when it sold out, for good. Each payment keeps the stage it was
-- bought at. Each change to a stage from its admin panel is recorded.

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "stageSlug" TEXT;

-- AlterTable
ALTER TABLE "TicketType" ADD COLUMN     "stageCap" INTEGER,
ADD COLUMN     "stageNote" TEXT,
ADD COLUMN     "stageSlug" TEXT,
ADD COLUMN     "stageSoldOutAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PricingStageChange" (
    "id" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "changedById" TEXT,
    "changedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingStageChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingStageChange_ticketTypeId_createdAt_idx" ON "PricingStageChange"("ticketTypeId", "createdAt");

-- AddForeignKey
ALTER TABLE "PricingStageChange" ADD CONSTRAINT "PricingStageChange_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingStageChange" ADD CONSTRAINT "PricingStageChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Manicuristas Imparables' three stages, each closing on its date or at its
-- cap, whichever comes first (dates in America/Bogota, stored in UTC):
--   creyente  Etapa Creyente   $90.000   200 cupos  until 18 Apr 2027, 23:59 (cierre de Nail Fest Cali)
--   decidida  Etapa Decidida  $120.000   300 cupos  until 30 May 2027, 23:59
--   full      Precio full     $150.000   no cap     until 27 Jun 2027, 08:00
-- From the ticket types as the previous version left them: «Etapa
-- Creyente», «Etapa 2» (now Decidida, open as soon as Creyente closes) and
-- «Precio normal» (now the full price); «Etapa 3» goes off sale, not
-- deleted. Their prices in dollars, only where they have one: Creyente
-- US$28, Decidida US$35 (what $120.000 already was in dollars), the full
-- price as it is.
UPDATE "TicketType" t
SET "stageSlug" = 'creyente', "price" = 90000, "stageCap" = 200, "stageNote" = 'cierre de Nail Fest Cali',
    "hideAfter" = TIMESTAMP '2027-04-19 04:59:00',
    "priceUsdCents" = CASE WHEN t."priceUsdCents" IS NULL THEN NULL ELSE 2800 END
FROM "Event" e
WHERE e."id" = t."eventId" AND e."theme" = 'IMPARABLES' AND t."stageSlug" IS NULL AND t."name" = 'Etapa Creyente';

UPDATE "TicketType" t
SET "stageSlug" = 'decidida', "name" = 'Etapa Decidida', "price" = 120000, "stageCap" = 300,
    "hideUntil" = NULL, "hideAfter" = TIMESTAMP '2027-05-31 04:59:00',
    "priceUsdCents" = CASE WHEN t."priceUsdCents" IS NULL THEN NULL ELSE 3500 END
FROM "Event" e
WHERE e."id" = t."eventId" AND e."theme" = 'IMPARABLES' AND t."stageSlug" IS NULL AND t."name" = 'Etapa 2';

UPDATE "TicketType" t
SET "status" = 'HIDDEN'
FROM "Event" e
WHERE e."id" = t."eventId" AND e."theme" = 'IMPARABLES' AND t."stageSlug" IS NULL AND t."name" = 'Etapa 3' AND t."status" = 'ON_SALE';

UPDATE "TicketType" t
SET "stageSlug" = 'full', "name" = 'Precio full', "price" = 150000, "stageCap" = NULL,
    "hideUntil" = NULL, "hideAfter" = TIMESTAMP '2027-06-27 13:00:00'
FROM "Event" e
WHERE e."id" = t."eventId" AND e."theme" = 'IMPARABLES' AND t."stageSlug" IS NULL AND t."name" = 'Precio normal';

-- The payments made before: each with the stage of its ticket.
UPDATE "Payment" p
SET "stageSlug" = t."stageSlug"
FROM "Registration" r
JOIN "TicketType" t ON t."id" = r."ticketTypeId"
WHERE p."registrationId" = r."id" AND p."stageSlug" IS NULL AND t."stageSlug" IS NOT NULL;

-- «¿Por qué sube el precio?» among the questions, right after «¿Cómo pago?»;
-- {{etapas}} reads each stage from its ticket type (ImparablesBlocks.tsx),
-- so the answer follows any change to them.
UPDATE "Event" e
SET "landingBlocks" = coalesce((
  SELECT jsonb_agg(
    CASE WHEN b ->> 'type' = 'faq' AND jsonb_typeof(b -> 'items') = 'array'
              AND EXISTS (SELECT 1 FROM jsonb_array_elements(b -> 'items') AS q(it) WHERE q.it ->> 'question' = '¿Cómo pago?')
              AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(b -> 'items') AS q(it) WHERE q.it ->> 'question' = '¿Por qué sube el precio?')
      THEN jsonb_set(b, '{items}', coalesce((
        SELECT jsonb_agg(x.item ORDER BY x.k, x.sub)
        FROM (
          SELECT it AS item, k, 0 AS sub FROM jsonb_array_elements(b -> 'items') WITH ORDINALITY AS t(it, k)
          UNION ALL
          SELECT jsonb_build_object('question', '¿Por qué sube el precio?', 'answer', 'Porque premiamos a las que deciden primero. {{etapas}} El precio nunca baja.'), k, 1
          FROM jsonb_array_elements(b -> 'items') WITH ORDINALITY AS t(it, k) WHERE it ->> 'question' = '¿Cómo pago?'
        ) AS x), b -> 'items'))
      ELSE b END
    ORDER BY i)
  FROM jsonb_array_elements(e."landingBlocks") WITH ORDINALITY AS u(b, i)), '[]'::jsonb)
WHERE e."theme" = 'IMPARABLES' AND jsonb_typeof(e."landingBlocks") = 'array' AND e."landingBlocks" <> '[]'::jsonb;
