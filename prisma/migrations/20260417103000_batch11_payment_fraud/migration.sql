-- Task 269: Record fraud assessment results on payments.

CREATE TYPE "FraudLevel" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

ALTER TABLE "payments"
    ADD COLUMN "fraudLevel" "FraudLevel",
    ADD COLUMN "fraudReasons" JSONB;
