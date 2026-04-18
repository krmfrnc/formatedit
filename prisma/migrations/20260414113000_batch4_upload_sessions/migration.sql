-- CreateEnum
CREATE TYPE "DocumentUploadSessionStatus" AS ENUM ('CREATED', 'UPLOADED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "processingProgress" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DocumentUploadSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "status" "DocumentUploadSessionStatus" NOT NULL DEFAULT 'CREATED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentUploadSession_userId_idx" ON "DocumentUploadSession"("userId");
CREATE INDEX "DocumentUploadSession_documentId_idx" ON "DocumentUploadSession"("documentId");
CREATE INDEX "DocumentUploadSession_status_idx" ON "DocumentUploadSession"("status");

ALTER TABLE "DocumentUploadSession" ADD CONSTRAINT "DocumentUploadSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentUploadSession" ADD CONSTRAINT "DocumentUploadSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
