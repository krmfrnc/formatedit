-- CreateEnum
CREATE TYPE "AnalysisTicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'QUOTED', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'CLOSED', 'CANCELLED');
CREATE TYPE "AnalysisTicketDeliveryMode" AS ENUM ('STANDARD', 'EXPRESS');

-- CreateTable
CREATE TABLE "analysis_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "assignedExpertUserId" TEXT,
    "categorySlug" TEXT NOT NULL,
    "categoryNameSnapshot" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "status" "AnalysisTicketStatus" NOT NULL DEFAULT 'OPEN',
    "deliveryMode" "AnalysisTicketDeliveryMode" NOT NULL DEFAULT 'STANDARD',
    "deadlineAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analysis_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analysis_tickets_ticketNumber_key" ON "analysis_tickets"("ticketNumber");

-- CreateIndex
CREATE INDEX "analysis_tickets_customerUserId_idx" ON "analysis_tickets"("customerUserId");

-- CreateIndex
CREATE INDEX "analysis_tickets_assignedExpertUserId_idx" ON "analysis_tickets"("assignedExpertUserId");

-- CreateIndex
CREATE INDEX "analysis_tickets_categorySlug_idx" ON "analysis_tickets"("categorySlug");

-- CreateIndex
CREATE INDEX "analysis_tickets_status_idx" ON "analysis_tickets"("status");

-- CreateIndex
CREATE INDEX "analysis_tickets_deadlineAt_idx" ON "analysis_tickets"("deadlineAt");

-- CreateIndex
CREATE INDEX "analysis_tickets_createdAt_idx" ON "analysis_tickets"("createdAt");

-- AddForeignKey
ALTER TABLE "analysis_tickets" ADD CONSTRAINT "analysis_tickets_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_tickets" ADD CONSTRAINT "analysis_tickets_assignedExpertUserId_fkey" FOREIGN KEY ("assignedExpertUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
