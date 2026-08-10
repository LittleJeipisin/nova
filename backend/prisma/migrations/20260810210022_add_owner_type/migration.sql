-- CreateEnum
CREATE TYPE "OwnerType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "ownerType" "OwnerType" NOT NULL DEFAULT 'PERMANENT';
