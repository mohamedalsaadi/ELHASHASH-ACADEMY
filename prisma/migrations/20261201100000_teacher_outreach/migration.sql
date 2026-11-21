-- CreateTable
CREATE TABLE "TeacherOutreach" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "sentById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stoppedAt" TIMESTAMP(3),

    CONSTRAINT "TeacherOutreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherOutreach_email_key" ON "TeacherOutreach"("email");
