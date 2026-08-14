-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "siteId" UUID;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "siteId" UUID;

-- AlterTable
ALTER TABLE "Visitor" ADD COLUMN     "siteId" UUID;

-- CreateTable
CREATE TABLE "Site" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Site_workspaceId_idx" ON "Site"("workspaceId");

-- CreateIndex
CREATE INDEX "Site_workspaceId_status_idx" ON "Site"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Site_workspaceId_slug_key" ON "Site"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "Conversation_siteId_idx" ON "Conversation"("siteId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_siteId_idx" ON "Conversation"("workspaceId", "siteId");

-- CreateIndex
CREATE INDEX "Conversation_workspaceId_siteId_status_idx" ON "Conversation"("workspaceId", "siteId", "status");

-- CreateIndex
CREATE INDEX "User_siteId_idx" ON "User"("siteId");

-- CreateIndex
CREATE INDEX "User_workspaceId_siteId_role_idx" ON "User"("workspaceId", "siteId", "role");

-- CreateIndex
CREATE INDEX "Visitor_siteId_idx" ON "Visitor"("siteId");

-- CreateIndex
CREATE INDEX "Visitor_workspaceId_siteId_idx" ON "Visitor"("workspaceId", "siteId");

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;
