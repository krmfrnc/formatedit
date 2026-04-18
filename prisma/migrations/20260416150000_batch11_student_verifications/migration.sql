-- Task 249: SheerID-backed student verification per user.
CREATE TYPE "StudentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

CREATE TABLE "student_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sheerid',
    "programId" TEXT NOT NULL,
    "verificationId" TEXT,
    "status" "StudentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "redirectUrl" TEXT,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_verifications_verificationId_key" ON "student_verifications"("verificationId");
CREATE INDEX "student_verifications_userId_idx" ON "student_verifications"("userId");
CREATE INDEX "student_verifications_status_idx" ON "student_verifications"("status");
CREATE INDEX "student_verifications_programId_idx" ON "student_verifications"("programId");

ALTER TABLE "student_verifications"
    ADD CONSTRAINT "student_verifications_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
