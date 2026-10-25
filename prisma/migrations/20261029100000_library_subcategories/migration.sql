-- Several themes per video, subcategories inside a theme (Navidad,
-- Halloween…) and the autopilot's version.

-- AlterTable
ALTER TABLE "LibraryVideo" ADD COLUMN     "extraThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "subcategories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "LibraryYoutubeVideo" ADD COLUMN     "aiVersion" INTEGER;

-- CreateTable
CREATE TABLE "LibrarySubcategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'ia',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibrarySubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LibrarySubcategory_key_key" ON "LibrarySubcategory"("key");

-- The special dates, written once, so the autopilot reuses these names
-- (none shows until it has three videos).
INSERT INTO "LibrarySubcategory" ("id", "key", "name", "theme", "createdBy", "updatedAt") VALUES
  ('sub_navidad', 'navidad', 'Navidad', 'tendencias', 'equipo', CURRENT_TIMESTAMP),
  ('sub_halloween', 'halloween', 'Halloween', 'tendencias', 'equipo', CURRENT_TIMESTAMP),
  ('sub_amor_y_amistad', 'amor-y-amistad', 'Amor y Amistad', 'tendencias', 'equipo', CURRENT_TIMESTAMP),
  ('sub_san_valentin', 'san-valentin', 'San Valentín', 'tendencias', 'equipo', CURRENT_TIMESTAMP),
  ('sub_dia_de_la_madre', 'dia-de-la-madre', 'Día de la Madre', 'tendencias', 'equipo', CURRENT_TIMESTAMP),
  ('sub_ano_nuevo', 'ano-nuevo', 'Año Nuevo', 'tendencias', 'equipo', CURRENT_TIMESTAMP),
  ('sub_novias_y_quinceaneras', 'novias-y-quinceaneras', 'Novias y quinceañeras', 'tendencias', 'equipo', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
