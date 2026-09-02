/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `LinkPageLink` table. All the data in the column will be lost.
  - You are about to drop the column `videoUrl` on the `LinkPageLink` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LinkTextAlign" AS ENUM ('LEFT', 'CENTER', 'RIGHT');

-- AlterTable
ALTER TABLE "LinkPageLink" DROP COLUMN "imageUrl",
DROP COLUMN "videoUrl",
ADD COLUMN     "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "textAlign" "LinkTextAlign" NOT NULL DEFAULT 'CENTER';

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "linksPageImageUrl" TEXT,
ADD COLUMN     "linksPageVideoUrl" TEXT;
