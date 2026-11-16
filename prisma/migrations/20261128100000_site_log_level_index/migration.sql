-- Lets the log page and the coworker filter by level without scanning the whole table.
CREATE INDEX "SiteLog_level_createdAt_idx" ON "SiteLog"("level", "createdAt");
