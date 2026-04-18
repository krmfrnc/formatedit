-- CreateEnum
CREATE TYPE "TicketFileType" AS ENUM ('DATA', 'DESCRIPTION', 'SAMPLE', 'RESULT');
CREATE TYPE "TicketMessageSender" AS ENUM ('CUSTOMER', 'EXPERT', 'SYSTEM');

-- AlterTable
ALTER TABLE "analysis_tickets"
ADD COLUMN "quotePriceCents" INTEGER,
ADD COLUMN "quoteNote" TEXT,
ADD COLUMN "quotedAt" TIMESTAMP(3),
ADD COLUMN "customerApprovedAt" TIMESTAMP(3),
ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxRevisions" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "rating" INTEGER,
ADD COLUMN "ratingComment" TEXT,
ADD COLUMN "ratedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ticket_files" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "fileType" "TicketFileType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderType" "TicketMessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nda_agreements" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "expertUserId" TEXT NOT NULL,
    "agreedAt" TIMESTAMP(3),
    "documentStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nda_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "maxConcurrent" INTEGER NOT NULL DEFAULT 3,
    "activeTickets" INTEGER NOT NULL DEFAULT 0,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "averageRating" DOUBLE PRECISION,
    "totalCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expertise_tags" (
    "id" TEXT NOT NULL,
    "expertProfileId" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expertise_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_add_ons" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_files_ticketId_idx" ON "ticket_files"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_files_fileType_idx" ON "ticket_files"("fileType");

-- CreateIndex
CREATE INDEX "ticket_files_uploadedByUserId_idx" ON "ticket_files"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "ticket_messages_senderUserId_idx" ON "ticket_messages"("senderUserId");

-- CreateIndex
CREATE INDEX "ticket_messages_createdAt_idx" ON "ticket_messages"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "nda_agreements_ticketId_key" ON "nda_agreements"("ticketId");

-- CreateIndex
CREATE INDEX "nda_agreements_expertUserId_idx" ON "nda_agreements"("expertUserId");

-- CreateIndex
CREATE UNIQUE INDEX "expert_profiles_userId_key" ON "expert_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "expertise_tags_expertProfileId_categorySlug_key" ON "expertise_tags"("expertProfileId", "categorySlug");

-- CreateIndex
CREATE INDEX "expertise_tags_categorySlug_idx" ON "expertise_tags"("categorySlug");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_categories_slug_key" ON "analysis_categories"("slug");

-- CreateIndex
CREATE INDEX "analysis_categories_isActive_idx" ON "analysis_categories"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_add_ons_slug_key" ON "analysis_add_ons"("slug");

-- CreateIndex
CREATE INDEX "analysis_add_ons_isActive_idx" ON "analysis_add_ons"("isActive");

-- AddForeignKey
ALTER TABLE "ticket_files" ADD CONSTRAINT "ticket_files_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "analysis_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_files" ADD CONSTRAINT "ticket_files_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "analysis_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_agreements" ADD CONSTRAINT "nda_agreements_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "analysis_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nda_agreements" ADD CONSTRAINT "nda_agreements_expertUserId_fkey" FOREIGN KEY ("expertUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expertise_tags" ADD CONSTRAINT "expertise_tags_expertProfileId_fkey" FOREIGN KEY ("expertProfileId") REFERENCES "expert_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
