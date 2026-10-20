-- CreateTable
CREATE TABLE "CuponeraList" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'category',
    "category" TEXT,
    "subcategory" TEXT,
    "productIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuponeraList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CuponeraList_slug_key" ON "CuponeraList"("slug");


-- The front page's first lists, editable in Editar cuponera (a list with
-- fewer than two products doesn't show).
INSERT INTO "CuponeraList" ("id", "slug", "title", "subtitle", "kind", "category", "subcategory", "position", "updatedAt") VALUES
  ('lista-esmaltes-semipermanentes', 'esmaltes-semipermanentes', 'Esmaltes semipermanentes', 'De todas las marcas', 'category', 'esmaltes', 'semipermanente', 0, CURRENT_TIMESTAMP),
  ('lista-preparacion-y-cuidado', 'preparacion-y-cuidado', 'Preparación y cuidado', 'Bases, top coats, cutículas y más', 'category', 'cuidado', NULL, 1, CURRENT_TIMESTAMP),
  ('lista-herramientas', 'herramientas', 'Herramientas y equipos', 'Lámparas, limas, pinceles y más', 'category', 'herramientas', NULL, 2, CURRENT_TIMESTAMP),
  ('lista-stamping', 'stamping', 'Stamping', 'Placas, esmaltes y sellos', 'category', 'stamping', NULL, 3, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
