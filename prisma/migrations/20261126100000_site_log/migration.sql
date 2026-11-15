-- Site log: one row per notable event or failure, read by the owner's /admin/logs. Additive.
CREATE TABLE "SiteLog" (
    "id" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "path" VARCHAR(200),
    "userId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteLog_createdAt_idx" ON "SiteLog"("createdAt");
CREATE INDEX "SiteLog_source_createdAt_idx" ON "SiteLog"("source", "createdAt");
