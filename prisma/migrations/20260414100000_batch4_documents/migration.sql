-- CreateEnum
CREATE TYPE "DocumentVersionType" AS ENUM ('RAW', 'WORKING', 'FORMATTED', 'REVISION', 'PREVIEW', 'FINAL', 'ARCHIVE');
CREATE TYPE "DocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Document" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "currentScanStatus" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING',
  "lastScanDetails" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "type" "DocumentVersionType" NOT NULL,
  "label" TEXT,
  "storageKey" TEXT,
  "contentType" TEXT,
  "sizeBytes" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSection" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentVersionId" TEXT,
  "parentSectionId" TEXT,
  "sectionType" TEXT NOT NULL,
  "title" TEXT,
  "content" JSONB,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "level" INTEGER,
  "confidenceScore" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentSecuritySetting" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "maxUploadSizeBytes" INTEGER NOT NULL DEFAULT 10485760,
  "clamAvEnabled" BOOLEAN NOT NULL DEFAULT false,
  "virusTotalEnabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentSecuritySetting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Document_userId_idx" ON "Document"("userId");
CREATE INDEX "Document_currentScanStatus_idx" ON "Document"("currentScanStatus");
CREATE INDEX "DocumentVersion_documentId_idx" ON "DocumentVersion"("documentId");
CREATE INDEX "DocumentVersion_type_idx" ON "DocumentVersion"("type");
CREATE INDEX "DocumentSection_documentId_idx" ON "DocumentSection"("documentId");
CREATE INDEX "DocumentSection_documentVersionId_idx" ON "DocumentSection"("documentVersionId");
CREATE INDEX "DocumentSection_parentSectionId_idx" ON "DocumentSection"("parentSectionId");

ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSection" ADD CONSTRAINT "DocumentSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentSection" ADD CONSTRAINT "DocumentSection_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DocumentSection" ADD CONSTRAINT "DocumentSection_parentSectionId_fkey" FOREIGN KEY ("parentSectionId") REFERENCES "DocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
