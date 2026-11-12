import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { QUIZ_TEMPLATE_URL } from "@/lib/quiz-template";
import { requireStaff } from "@/lib/staff";
import { pageMetadata } from "@/lib/seo";
import { TeacherNav } from "../../TeacherNav";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return pageMetadata(params, "/teacher/guide/google-forms", "quizGuide", { noindex: true });
}

const STEPS = ["s1", "s2", "s3", "s4"] as const;
const RESULTS = ["rOk", "rNot", "rBad", "rDup", "rNone"] as const;
const TIPS = ["t1", "t2", "t3"] as const;

/** A short manual for teachers: a Google Form quiz that only subscribers can open, with every answer matched to a student. */
export default async function GoogleFormsGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireStaff();
  const t = await getTranslations("quizGuide");

  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <PageHeader title={t("title")} />
      <TeacherNav current="assignments" />
      <p className="text-body text-ink-muted">{t("intro")}</p>

      <div className="grid gap-2">
        <a href={QUIZ_TEMPLATE_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-fit px-5 py-3">{t("template")}</a>
        <p className="text-small text-ink-muted">{t("templateNote")}</p>
      </div>

      <ol className="grid gap-4">
        {STEPS.map((k, i) => (
          <li key={k} className="grid gap-1 rounded-lg border border-hairline bg-surface p-4">
            <h2 className="flex items-center gap-3 font-display text-h3 font-semibold">
              <span aria-hidden="true" className="num grid size-8 shrink-0 place-items-center rounded-full border border-pen text-small text-pen">{i + 1}</span>
              {t(`${k}t`)}
            </h2>
            <p className="text-body text-ink-muted">{t(k)}</p>
          </li>
        ))}
      </ol>

      <section className="grid gap-2">
        <h2 className="font-display text-h3 font-semibold">{t("resultsTitle")}</h2>
        <ul className="grid list-disc gap-1 ps-5 text-body text-ink-muted">
          {RESULTS.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-h3 font-semibold">{t("limitsTitle")}</h2>
        <p className="text-body text-ink-muted">{t("limits")}</p>
      </section>

      <section className="grid gap-2">
        <h2 className="font-display text-h3 font-semibold">{t("tipsTitle")}</h2>
        <ul className="grid list-disc gap-1 ps-5 text-body text-ink-muted">
          {TIPS.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
