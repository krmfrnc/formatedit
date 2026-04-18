-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "workType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "templateParameters" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "sourceUserTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "baseTemplateId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isPromoted" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "templateParameters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_slug_key" ON "Template"("slug");
CREATE INDEX "Template_category_idx" ON "Template"("category");
CREATE INDEX "Template_workType_idx" ON "Template"("workType");
CREATE INDEX "Template_isActive_idx" ON "Template"("isActive");
CREATE INDEX "UserTemplate_userId_idx" ON "UserTemplate"("userId");
CREATE INDEX "UserTemplate_baseTemplateId_idx" ON "UserTemplate"("baseTemplateId");
CREATE INDEX "UserTemplate_isArchived_idx" ON "UserTemplate"("isArchived");
CREATE INDEX "UserTemplate_isPromoted_idx" ON "UserTemplate"("isPromoted");

-- AddForeignKey
ALTER TABLE "Template"
ADD CONSTRAINT "Template_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserTemplate"
ADD CONSTRAINT "UserTemplate_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTemplate"
ADD CONSTRAINT "UserTemplate_baseTemplateId_fkey"
FOREIGN KEY ("baseTemplateId") REFERENCES "Template"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
