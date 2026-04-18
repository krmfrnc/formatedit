-- Batch 7 hard-rule fix: templates become immutable. Updates create a new
-- row linked back to the archived predecessor via previousVersionId.

ALTER TABLE "Template" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Template" ADD COLUMN "previousVersionId" TEXT;

ALTER TABLE "Template"
  ADD CONSTRAINT "Template_previousVersionId_fkey"
  FOREIGN KEY ("previousVersionId") REFERENCES "Template"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Template_isArchived_idx" ON "Template"("isArchived");
CREATE INDEX "Template_previousVersionId_idx" ON "Template"("previousVersionId");
