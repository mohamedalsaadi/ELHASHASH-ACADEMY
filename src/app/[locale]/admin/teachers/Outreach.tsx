import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { MAX_PER_SEND } from "@/lib/teacher-outreach";
import { SaveButton } from "../ui";
import { panel, table } from "../AdminNav";
import { field } from "../styles";
import { markOutreachStopped, sendTeacherInvitations, sendTeacherInviteTestCopy } from "./outreach-actions";

type Flags = Record<string, string | undefined>;

/** Email the teacher invitation to people who are not on Dhirwa yet, from the admin. */
export async function Outreach({ locale, flags }: { locale: string; flags: Flags }) {
  const t = await getTranslations("office");
  const rows = await db.teacherOutreach.findMany({ orderBy: { sentAt: "desc" }, take: 30, select: { id: true, email: true, locale: true, sentAt: true, stoppedAt: true } });
  const date = new Intl.DateTimeFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Dubai" });
  const o = flags.outreach;
  const message =
    o === "done"
      ? t("outreachDone", { sent: Number(flags.sent ?? 0), already: Number(flags.already ?? 0), failed: Number(flags.failed ?? 0), invalid: Number(flags.invalid ?? 0), tooMany: Number(flags.tooMany ?? 0) })
      : o === "test_ok"
        ? t("outreachTestOk")
        : o === "test_fail"
          ? t("outreachTestFail")
          : o === "noemail"
            ? t("outreachNoEmail")
            : o === "invalid"
              ? t("outreachInvalid")
              : null;

  return (
    <section id="outreach" className="grid gap-3">
      <h2 className="font-display text-h2 font-semibold">{t("outreachTitle")}</h2>
      <p className="max-w-[65ch] text-small text-ink-muted">{t("outreachHint", { max: MAX_PER_SEND })}</p>
      {message && (
        <p role="status" className="rounded-md border border-hairline bg-raised px-3 py-2 text-small">
          {message}
          {flags.detail ? <span dir="ltr" className="ms-2 text-ink-muted">{flags.detail}</span> : null}
        </p>
      )}
      <form action={sendTeacherInvitations} className={panel}>
        <label className="grid gap-1 text-label text-ink-muted">
          {t("outreachEmails")}
          <textarea name="emails" required rows={4} maxLength={4000} dir="ltr" placeholder="teacher@example.com" className={field} />
        </label>
        <label className="grid max-w-60 gap-1 text-label text-ink-muted">
          {t("outreachLang")}
          <select name="lang" defaultValue={locale === "en" ? "en" : "ar"} className={field}>
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </label>
        <label className="flex min-h-11 items-start gap-2 text-small">
          <input type="checkbox" name="confirm" required className="mt-1 size-4" />
          {t("outreachConfirm")}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <SaveButton showSaved={false}>{t("outreachSend")}</SaveButton>
          <button formAction={sendTeacherInviteTestCopy} formNoValidate className="link-tap text-small text-pen underline underline-offset-4">
            {t("outreachTest")}
          </button>
        </div>
      </form>
      <div className={`${panel} overflow-x-auto`}>
        {rows.length ? (
          <table className={table}>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td dir="ltr" className="num">{r.email}</td>
                  <td className="num">{date.format(r.sentAt)}</td>
                  <td>
                    {r.stoppedAt ? (
                      <span className="text-ink-muted">{t("outreachStopped")}</span>
                    ) : (
                      <form action={markOutreachStopped}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="link-tap text-small text-pen underline underline-offset-4">{t("outreachMarkStop")}</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-small text-ink-muted">{t("outreachNone")}</p>
        )}
      </div>
    </section>
  );
}
