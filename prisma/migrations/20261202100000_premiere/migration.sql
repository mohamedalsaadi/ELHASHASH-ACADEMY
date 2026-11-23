-- CreateTable
CREATE TABLE "Premiere" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "blurbAr" TEXT,
    "blurbEn" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "replay" BOOLEAN NOT NULL DEFAULT true,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Premiere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PremiereRsvp" (
    "userId" TEXT NOT NULL,
    "premiereId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PremiereRsvp_pkey" PRIMARY KEY ("userId","premiereId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Premiere_slug_key" ON "Premiere"("slug");

-- CreateIndex
CREATE INDEX "Premiere_courseId_startsAt_idx" ON "Premiere"("courseId", "startsAt");

-- AddForeignKey
ALTER TABLE "Premiere" ADD CONSTRAINT "Premiere_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Premiere" ADD CONSTRAINT "Premiere_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "VideoAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiereRsvp" ADD CONSTRAINT "PremiereRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PremiereRsvp" ADD CONSTRAINT "PremiereRsvp_premiereId_fkey" FOREIGN KEY ("premiereId") REFERENCES "Premiere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
