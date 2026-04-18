-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "citationStyleId" TEXT,
    "sourceOrder" INTEGER NOT NULL DEFAULT 0,
    "rawText" TEXT NOT NULL,
    "normalizedText" TEXT,
    "citationKey" TEXT,
    "parsedData" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Citation_documentId_idx" ON "Citation"("documentId");

-- CreateIndex
CREATE INDEX "Citation_documentVersionId_idx" ON "Citation"("documentVersionId");

-- CreateIndex
CREATE INDEX "Citation_citationStyleId_idx" ON "Citation"("citationStyleId");

-- CreateIndex
CREATE INDEX "Citation_sourceOrder_idx" ON "Citation"("sourceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Citation_documentVersionId_sourceOrder_key" ON "Citation"("documentVersionId", "sourceOrder");

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "DocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_citationStyleId_fkey" FOREIGN KEY ("citationStyleId") REFERENCES "CitationStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
