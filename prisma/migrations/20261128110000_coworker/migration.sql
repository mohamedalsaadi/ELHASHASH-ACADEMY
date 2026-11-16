-- The log coworker: one row per problem it has noticed, and a single control row (pause and auto-merge switches).
CREATE TABLE "CoworkerCase" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'FIX',
    "parentId" TEXT,
    "source" TEXT NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "knownCode" TEXT,
    "route" TEXT,
    "routeKind" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "count" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branch" TEXT,
    "prNumber" INTEGER,
    "mergedSha" TEXT,
    "mergedAt" TIMESTAMP(3),
    "edits" JSONB,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkerCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoworkerCase_fingerprint_key" ON "CoworkerCase"("fingerprint");
CREATE INDEX "CoworkerCase_status_idx" ON "CoworkerCase"("status");

CREATE TABLE "CoworkerControl" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "autoMerge" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoworkerControl_pkey" PRIMARY KEY ("id")
);
