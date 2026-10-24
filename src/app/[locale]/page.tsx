import { BookOpenCheck, CalendarClock, Languages, LockKeyhole, Radio, Smartphone, Unlock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Intro } from "@/components/brand/Intro";
import { CourseCard } from "@/components/CourseCard";
import { TeacherPhoto } from "@/components/TeacherPhoto";
import { Link } from "@/i18n/navigation";
import { cardInclude } from "@/lib/catalog";
import { db } from "@/lib/db";

// Catalog data changes rarely; a five-minute cache keeps the home page fast.
export const revalidate = 300;

const button =
  "inline-flex items-center justify-center rounded-md px-6 py-3.5 font-display font-semibold transition-colors duration-(--dur-fast) ease-(--ease-out)";

function getHome() {
  const published = { published: true };
  return Promise.all([
    db.grade.findMany({
      where: { courses: { some: published } },
      orderBy: [{ country: { code: "asc" } }, { level: "asc" }],
      include: { country: true, _count: { select: { courses: { where: published } } } },
    }),
    db.user.findMany({
      where: { role: "INSTRUCTOR", courses: { some: published } },
      orderBy: { createdAt: "desc" }, // newest first: the seeded sample instructor is the oldest
      take: 6,
      select: { id: true, name: true, photoUrl: true, courses: { where: published, select: { subject: true } } },
    }),
    db.course.findMany({ where: { kind: "SKILL", ...published }, orderBy: { createdAt: "desc" }, take: 3, include: cardInclude(new Date()) }),
  ]);
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, [grades, teachers, skills]] = await Promise.all([getTranslations("home"), getHome()]);
  const ar = locale === "ar";
  const lead = teachers[0]?.name;

  const ways = [
    { key: "subscribe", Icon: BookOpenCheck, soon: false },
    { key: "rent", Icon: CalendarClock, soon: false },
    { key: "live", Icon: Radio, soon: false },
  ] as const;
  const trust = [
    { key: "free", Icon: Unlock },
    { key: "device", Icon: Smartphone },
    { key: "pay", Icon: LockKeyhole },
    { key: "lang", Icon: Languages },
  ] as const;

  return (
    <main>
      <Intro locale={locale} />

      <section className="paper-lines border-b border-hairline">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:grid-cols-[1.4fr_1fr] md:py-20">
          <div className="grid gap-6">
            <p className="text-ink-muted">{t("eyebrow")}</p>
            <h1 className="font-display text-hero leading-[1.15] font-extrabold text-balance">
              {t.rich("headline", { m: (c) => <span className="marker">{c}</span> })}
            </h1>
            <p className="max-w-[52ch] text-[1.125rem] text-ink-muted">{t("lede")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/courses" className={`${button} bg-primary text-on-primary hover:bg-[color-mix(in_oklab,var(--color-primary)_86%,#fff)]`}>
                {t("ctaFree")}
              </Link>
              <a href="#grades" className={`${button} border-[1.5px] border-ink hover:bg-marker`}>
                {t("ctaGrade")}
              </a>
            </div>
          </div>

          <div aria-hidden="true" className="relative mx-auto w-full max-w-[400px]">
            <div className="paper-lines grid -rotate-3 gap-3 rounded-sm bg-surface p-7 shadow-paper [background-size:100%_34px] [--color-rule:#E6ECF7]">
              <span className="text-small text-ink-muted">{t("paper.label")}</span>
              <span className="font-display text-h3 font-semibold">{t("paper.q")}</span>
              <span className="text-ink-muted">{t("paper.a")}</span>
              <span className="h-20" />
              {lead && <span className="pe-28 text-small">{t("paper.markedBy", { name: lead })}</span>}
              <svg viewBox="0 0 120 120" className="absolute end-6 bottom-6 size-24" role="img" aria-label={t("paper.score")}>
                <path className="eh-score" pathLength={1} d="M60 8c30 0 52 22 52 50s-24 54-54 54S8 88 8 60 30 10 56 8" fill="none" strokeWidth="4" strokeLinecap="round" stroke="var(--color-pen)" />
                <text x="60" y="58" textAnchor="middle" className="fill-pen font-display" fontWeight="800" fontSize="34">{ar ? "٤٨" : "48"}</text>
                <line x1="34" y1="68" x2="86" y2="68" stroke="var(--color-pen)" strokeWidth="3" />
                <text x="60" y="96" textAnchor="middle" className="fill-pen font-display" fontWeight="600" fontSize="22">{ar ? "٥٠" : "50"}</text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-20 px-4 py-16">
        <section className="grid gap-6">
          <h2 className="font-display text-h1 font-extrabold">{t("ways.title")}</h2>
          <ul className="grid gap-5 md:grid-cols-3">
            {ways.map(({ key, Icon, soon }) => (
              <li key={key} className="grid content-start gap-3 rounded-lg border border-hairline bg-surface p-6 shadow-paper">
                <span className="flex items-center justify-between">
                  <Icon aria-hidden="true" className="size-8 text-pen" strokeWidth={1.75} />
                  {soon && <span className="rounded-full bg-raised px-2.5 py-0.5 text-label text-ink-muted">{t("ways.soon")}</span>}
                </span>
                <h3 className="font-display text-h3 font-bold">{t(`ways.${key}.title`)}</h3>
                <p className="text-ink-muted">{t(`ways.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {grades.length > 0 && (
          <section id="grades" className="grid scroll-mt-24 gap-6">
            <h2 className="font-display text-h1 font-extrabold">{t("grades.title")}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grades.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/courses#g-${g.id}`}
                    className="flex h-full items-center justify-between gap-3 rounded-md border-[1.5px] border-ink bg-surface px-5 py-4 transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-marker"
                  >
                    <span className="grid">
                      <span className="font-display font-bold">{ar ? g.nameAr : g.nameEn}</span>
                      <span className="text-small text-ink-muted">{ar ? g.country.nameAr : g.country.nameEn}</span>
                    </span>
                    <span className="text-small text-ink-muted">{t("grades.count", { count: g._count.courses })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {teachers.length > 0 && (
          <section className="grid gap-6">
            <h2 className="font-display text-h1 font-extrabold">{t("teachers.title")}</h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {teachers.map((p) => {
                const subjects = [...new Set(p.courses.flatMap((c) => (c.subject ? [ar ? c.subject.nameAr : c.subject.nameEn] : [])))];
                return (
                  <li key={p.id}>
                    <Link
                      href={`/teachers/${p.id}`}
                      className="grid h-full justify-items-center gap-3 rounded-lg border border-hairline bg-surface p-6 text-center shadow-paper transition-transform duration-(--dur-fast) ease-(--ease-out) hover:-translate-y-0.5"
                    >
                      <TeacherPhoto name={p.name} url={p.photoUrl} size={112} />
                      <span className="font-display text-h3 font-extrabold">{p.name}</span>
                      {subjects.length > 0 && <span className="marker text-small">{subjects.join(" · ")}</span>}
                      <span className="mt-1 text-small font-semibold underline decoration-pen decoration-2 underline-offset-4">{t("teachers.page")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {skills.length > 0 && (
          <section className="grid gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-2">
                <h2 className="font-display text-h1 font-extrabold">{t("skills.title")}</h2>
                <p className="text-ink-muted">{t("skills.lede")}</p>
              </div>
              <Link href="/courses#skills" className="font-semibold underline decoration-pen decoration-2 underline-offset-4">
                {t("skills.all")}
              </Link>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {skills.map((c) => (
                <li key={c.id}>
                  <CourseCard course={c} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <ul className="grid gap-4 rounded-lg bg-primary p-6 text-on-primary sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ key, Icon }) => (
            <li key={key} className="flex items-center gap-3">
              <Icon aria-hidden="true" className="size-6 shrink-0 text-marker" strokeWidth={1.75} />
              <span className="text-small">{t(`trust.${key}`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
