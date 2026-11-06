import { db } from "@/lib/db";

/**
 * Records one model call. Never the prompt, never the reply: a minor's words must not end up in a log
 * that outlives the data they describe. Failures here must never break the feature they measure.
 */
export async function logAiRun(run: {
  kind: "grade" | "support_draft" | "assistant";
  model: string;
  tokensIn?: number;
  tokensOut?: number;
  actorId?: string | null;
  studentId?: string | null;
  status?: "OK" | "ERROR";
}) {
  await db.aiRun
    .create({
      data: {
        kind: run.kind,
        model: run.model,
        tokensIn: run.tokensIn ?? 0,
        tokensOut: run.tokensOut ?? 0,
        actorId: run.actorId ?? null,
        studentId: run.studentId ?? null,
        status: run.status ?? "OK",
      },
    })
    .catch(() => {});
}
