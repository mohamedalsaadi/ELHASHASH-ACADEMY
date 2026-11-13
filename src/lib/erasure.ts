import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";

export type ErasureCounts = { records: number; files: number };

/** What a deleted account is called afterwards. Paired with a null phone and email, so nobody can sign in as it. */
const ERASED_NAME = "حساب محذوف";

/**
 * Erases a person's data without deleting the row.
 *
 * `Order.userId` and `Order.beneficiaryId` are `onDelete: Restrict`, and an invoice has to survive for
 * accounting and tax. So the account becomes an anonymised shell: every personal field is blanked,
 * every row that is the person's own activity is deleted, and the password hash is replaced with a
 * value no password can match. Teachers and admins are refused by the caller: courses, assignments,
 * exam papers and question-bank items still point at them, and their content is licensed under a
 * separate agreement.
 */
export async function eraseAccount(userId: string): Promise<ErasureCounts> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true } });

  // Collected before the rows go, so the files can be removed after the transaction commits.
  const files = await db.submissionFile.findMany({
    where: { submission: { studentId: userId } },
    select: { pathname: true },
  });

  let records = 0;
  const count = async (p: Promise<{ count: number }>) => {
    records += (await p).count;
  };

  await db.$transaction(async (trx) => {
    await count(trx.submissionFile.deleteMany({ where: { submission: { studentId: userId } } }));
    await count(trx.submission.deleteMany({ where: { studentId: userId } }));
    await count(trx.question.deleteMany({ where: { userId } }));
    await count(trx.practiceAnswer.deleteMany({ where: { attempt: { userId } } }));
    await count(trx.practiceAttempt.deleteMany({ where: { userId } }));
    await count(trx.examAnswer.deleteMany({ where: { attempt: { userId } } }));
    await count(trx.examAttempt.deleteMany({ where: { userId } }));
    await count(trx.quizAttempt.deleteMany({ where: { userId } }));
    await count(trx.lessonView.deleteMany({ where: { userId } }));
    await count(trx.reviewSchedule.deleteMany({ where: { userId } }));
    await count(trx.courseReview.deleteMany({ where: { studentId: userId } }));
    await count(trx.studentProgress.deleteMany({ where: { userId } }));
    await count(trx.liveAttendance.deleteMany({ where: { userId } }));
    await count(trx.notification.deleteMany({ where: { userId } }));
    await count(trx.token.deleteMany({ where: { userId } }));
    await count(trx.deviceSession.deleteMany({ where: { userId } }));
    await count(trx.parentCode.deleteMany({ where: { studentId: userId } }));
    await count(trx.parentLink.deleteMany({ where: { OR: [{ parentId: userId }, { studentId: userId }] } }));
    await count(trx.guardianConsent.deleteMany({ where: { OR: [{ studentId: userId }, { parentId: userId }] } }));
    await count(trx.specialRequest.deleteMany({ where: { OR: [{ authorId: userId }, { studentId: userId }] } }));
    await count(trx.entitlement.deleteMany({ where: { userId } }));
    // Analytics rows are not the person's content, but they are keyed to them; drop the key, keep the count.
    await count(trx.analyticsEvent.updateMany({ where: { userId }, data: { userId: null, sessionId: null } }));
    if (user.email) await count(trx.supportTicket.deleteMany({ where: { email: user.email } }));

    // Orders, order items and ledger entries stay: they are the money record. The row they point at
    // is now anonymous.
    await trx.user.update({
      where: { id: userId },
      data: {
        name: ERASED_NAME,
        phone: null,
        email: null,
        emailVerifiedAt: null,
        photoUrl: null,
        photoType: null,
        bioAr: null,
        bioEn: null,
        liveApproved: false,
        gradeId: null,
        // Not a bcrypt hash, so no password can match it.
        passwordHash: `erased:${randomUUID()}`,
        passwordChangedAt: new Date(),
        deletedAt: new Date(),
      },
    });
  });

  // Best effort: a file left behind is unlinked from every row and unreachable through the app.
  for (const f of files) {
    try {
      await del(f.pathname);
    } catch {
      // Ignore: the database transaction already removed the reference.
    }
  }

  return { records, files: files.length };
}
