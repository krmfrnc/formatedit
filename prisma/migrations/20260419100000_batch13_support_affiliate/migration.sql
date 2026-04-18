-- Task 309: Customer support tickets.

CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'AWAITING_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'TELEGRAM');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "SupportMessageSender" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

CREATE TABLE "support_tickets" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "subject"   TEXT NOT NULL,
    "status"    "SupportTicketStatus"   NOT NULL DEFAULT 'OPEN',
    "channel"   "SupportTicketChannel"  NOT NULL DEFAULT 'IN_APP',
    "priority"  "SupportTicketPriority" NOT NULL DEFAULT 'NORMAL',
    "closedAt"  TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_tickets_userId_idx" ON "support_tickets" ("userId");
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" ("status");
CREATE INDEX "support_tickets_createdAt_idx" ON "support_tickets" ("createdAt");

ALTER TABLE "support_tickets"
    ADD CONSTRAINT "support_tickets_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "support_messages" (
    "id"           TEXT NOT NULL,
    "ticketId"     TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderRole"   "SupportMessageSender" NOT NULL,
    "body"         TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_messages_ticketId_idx" ON "support_messages" ("ticketId");
CREATE INDEX "support_messages_createdAt_idx" ON "support_messages" ("createdAt");

ALTER TABLE "support_messages"
    ADD CONSTRAINT "support_messages_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_messages"
    ADD CONSTRAINT "support_messages_senderUserId_fkey"
    FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tasks 316-318: Affiliate program.

CREATE TYPE "AffiliateStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "AffiliateRewardStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

CREATE TABLE "affiliates" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "code"              TEXT NOT NULL,
    "status"            "AffiliateStatus" NOT NULL DEFAULT 'ACTIVE',
    "commissionPercent" INTEGER NOT NULL DEFAULT 10,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "affiliates_userId_key" ON "affiliates" ("userId");
CREATE UNIQUE INDEX "affiliates_code_key" ON "affiliates" ("code");

ALTER TABLE "affiliates"
    ADD CONSTRAINT "affiliates_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "referrals" (
    "id"             TEXT NOT NULL,
    "affiliateId"    TEXT NOT NULL,
    "referredUserId" TEXT,
    "ipHash"         TEXT,
    "landingUrl"     TEXT,
    "convertedAt"    TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "referrals_referredUserId_key" ON "referrals" ("referredUserId");
CREATE INDEX "referrals_affiliateId_idx" ON "referrals" ("affiliateId");
CREATE INDEX "referrals_ipHash_idx" ON "referrals" ("ipHash");

ALTER TABLE "referrals"
    ADD CONSTRAINT "referrals_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "affiliate_rewards" (
    "id"          TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "referralId"  TEXT,
    "paymentId"   TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency"    TEXT NOT NULL,
    "status"      "AffiliateRewardStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt"  TIMESTAMP(3),
    "paidAt"      TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_rewards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "affiliate_rewards_affiliateId_idx" ON "affiliate_rewards" ("affiliateId");
CREATE INDEX "affiliate_rewards_status_idx" ON "affiliate_rewards" ("status");

ALTER TABLE "affiliate_rewards"
    ADD CONSTRAINT "affiliate_rewards_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "affiliates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
