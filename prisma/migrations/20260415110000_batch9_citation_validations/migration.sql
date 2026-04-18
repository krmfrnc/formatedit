-- CreateEnum
CREATE TYPE "CitationValidationSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateTable
CREATE TABLE "CitationValidation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "citationId" TEXT,
    "citationStyleId" TEXT,
    "severity" "CitationValidationSeverity" NOT NULL,
    "validationType" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fieldPath" TEXT,
    "metadata" JSONB,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitationValidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CitationValidation_documentId_idx" ON "CitationValidation"("documentId");

-- CreateIndex
CREATE INDEX "CitationValidation_documentVersionId_idx" ON "CitationValidation"("documentVersionId");

-- CreateIndex
CREATE INDEX "CitationValidation_citationId_idx" ON "CitationValidation"("citationId");

-- CreateIndex
CREATE INDEX "CitationValidation_citationStyleId_idx" ON "CitationValidation"("citationStyleId");

-- CreateIndex
CREATE INDEX "CitationValidation_severity_idx" ON "CitationValidation"("severity");

-- CreateIndex
CREATE INDEX "CitationValidation_isResolved_idx" ON "CitationValidation"("isResolved");

-- AddForeignKey
ALTER TABLE "CitationValidation" ADD CONSTRAINT "CitationValidation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationValidation" ADD CONSTRAINT "CitationValidation_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationValidation" ADD CONSTRAINT "CitationValidation_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationValidation" ADD CONSTRAINT "CitationValidation_citationStyleId_fkey" FOREIGN KEY ("citationStyleId") REFERENCES "CitationStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
