-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledById" TEXT;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

