-- Tasks 257, 258, 269: Contact + country fields on User for notifications and fraud checks.

ALTER TABLE "User"
    ADD COLUMN "phoneNumber" TEXT,
    ADD COLUMN "telegramChatId" TEXT,
    ADD COLUMN "country" TEXT;
