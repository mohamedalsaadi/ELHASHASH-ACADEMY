-- Additive only: bank questions on a homework or quiz, and each student's answer to them.
CREATE TABLE "AssignmentItem" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AssignmentItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmissionAnswer" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "choiceId" TEXT,
    "choiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "text" VARCHAR(2000),
    "correct" BOOLEAN,
    "marks" INTEGER,
    "aiMarks" INTEGER,
    "aiFeedback" VARCHAR(1000),
    CONSTRAINT "SubmissionAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssignmentItem_assignmentId_itemId_key" ON "AssignmentItem"("assignmentId", "itemId");
CREATE INDEX "AssignmentItem_assignmentId_order_idx" ON "AssignmentItem"("assignmentId", "order");
CREATE UNIQUE INDEX "SubmissionAnswer_submissionId_itemId_key" ON "SubmissionAnswer"("submissionId", "itemId");

ALTER TABLE "AssignmentItem" ADD CONSTRAINT "AssignmentItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssignmentItem" ADD CONSTRAINT "AssignmentItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubmissionAnswer" ADD CONSTRAINT "SubmissionAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "QuestionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
