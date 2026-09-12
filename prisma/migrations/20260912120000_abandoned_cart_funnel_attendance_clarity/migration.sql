-- CreateEnum
CREATE TYPE "AttendanceIntent" AS ENUM ('CONFIRMED', 'DECLINED');

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "cartEmail1SentAt" TIMESTAMP(3),
ADD COLUMN     "cartEmail2SentAt" TIMESTAMP(3),
ADD COLUMN     "attendanceIntent" "AttendanceIntent";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "checkoutOpenedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "WhatsAppTemplate" ADD COLUMN     "isAttendancePoll" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrgSettings" ADD COLUMN     "clarityProjectId" TEXT;
