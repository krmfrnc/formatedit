-- Task 272: Feature flags.

CREATE TYPE "FeatureFlagAudience" AS ENUM ('EVERYONE', 'ADMINS_ONLY', 'PERCENTAGE_ROLLOUT', 'USER_LIST');

CREATE TABLE "feature_flags" (
    "key"            TEXT NOT NULL,
    "description"    TEXT,
    "enabled"        BOOLEAN NOT NULL DEFAULT false,
    "audience"       "FeatureFlagAudience" NOT NULL DEFAULT 'EVERYONE',
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "allowedUserIds" JSONB,
    "metadata"       JSONB,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    "updatedBy"      TEXT,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);

-- Task 288: Announcement banner content.

CREATE TYPE "AnnouncementSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TABLE "announcements" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "severity"    "AnnouncementSeverity" NOT NULL DEFAULT 'INFO',
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "startsAt"    TIMESTAMP(3),
    "endsAt"      TIMESTAMP(3),
    "audience"    TEXT NOT NULL DEFAULT 'ALL',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "announcements_isActive_idx" ON "announcements" ("isActive");

-- Task 289: Legal documents (versioned).

CREATE TYPE "LegalDocumentSlug" AS ENUM ('TERMS', 'PRIVACY', 'KVKK', 'COOKIES');

CREATE TABLE "legal_documents" (
    "id"          TEXT NOT NULL,
    "slug"        "LegalDocumentSlug" NOT NULL,
    "locale"      TEXT NOT NULL DEFAULT 'tr',
    "title"       TEXT NOT NULL,
    "content"     TEXT NOT NULL,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "updatedBy"   TEXT,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legal_documents_slug_locale_version_key"
    ON "legal_documents" ("slug", "locale", "version");

CREATE INDEX "legal_documents_slug_locale_isActive_idx"
    ON "legal_documents" ("slug", "locale", "isActive");

-- Task 284: Analytics report history.

CREATE TYPE "AnalyticsReportType" AS ENUM ('WEEKLY', 'MONTHLY', 'ON_DEMAND');
CREATE TYPE "AnalyticsReportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "analytics_reports" (
    "id"           TEXT NOT NULL,
    "type"         "AnalyticsReportType" NOT NULL,
    "status"       "AnalyticsReportStatus" NOT NULL DEFAULT 'PENDING',
    "periodStart"  TIMESTAMP(3) NOT NULL,
    "periodEnd"    TIMESTAMP(3) NOT NULL,
    "metrics"      JSONB NOT NULL,
    "generatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailedTo"    JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "analytics_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_reports_type_idx" ON "analytics_reports" ("type");
CREATE INDEX "analytics_reports_generatedAt_idx" ON "analytics_reports" ("generatedAt");
