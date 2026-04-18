-- CreateTable
CREATE TABLE "WorkTypeSetting" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiredFixedPages" JSONB NOT NULL,
    "optionalFixedPages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTypeSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkTypeSetting_slug_key" ON "WorkTypeSetting"("slug");

-- CreateIndex
CREATE INDEX "WorkTypeSetting_isActive_idx" ON "WorkTypeSetting"("isActive");
