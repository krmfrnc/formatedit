-- CreateEnum
CREATE TYPE "CitationStyleFamily" AS ENUM ('AUTHOR_DATE', 'NUMERIC', 'NOTES_BIBLIOGRAPHY');

-- CreateTable
CREATE TABLE "CitationStyle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "family" "CitationStyleFamily" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CitationStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CitationStyle_slug_key" ON "CitationStyle"("slug");

-- CreateIndex
CREATE INDEX "CitationStyle_family_idx" ON "CitationStyle"("family");

-- CreateIndex
CREATE INDEX "CitationStyle_isActive_idx" ON "CitationStyle"("isActive");
