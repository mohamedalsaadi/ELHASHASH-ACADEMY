import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { Link } from "@/i18n/navigation";
import { alternates } from "@/lib/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({
    title: locale === "ar" ? "إمكانية الوصول" : "Accessibility",
    alternates: alternates(locale, "/accessibility"),
  }));
}

const ar: Section[] = [
  {
    h: "هدفنا",
    body: (
      <p>
        نسعى إلى مطابقة مستوى WCAG 2.2 AA في الصفحات التي نملكها: الدروس والقوائم وصفحات الدفع والحساب. هذا التزام
        مستمر لا شهادة، وقد نواجه أخطاء نصلحها عند العلم بها.
      </p>
    ),
  },
  {
    h: "ما هو مطبَّق الآن",
    body: (
      <>
        <ul>
          <li>كل عناصر التحكم على الصفحة الرئيسية بحجم 44 بكسل على الأقل، ويتحقق من ذلك اختبار آلي في كل إصدار.</li>
          <li>تركيز مرئي واضح، وترتيب تنقل منطقي بلوحة المفاتيح.</li>
          <li>احترام إعداد تقليل الحركة في النظام.</li>
          <li>نصوص عربية وإنجليزية بتباين مقيس، واتجاه RTL كامل.</li>
          <li>أسماء يمكن لقارئ الشاشة نطقها لحقول الاختبار والواجبات والأسئلة.</li>
        </ul>
      </>
    ),
  },
  {
    h: "ما لا نتحكم فيه",
    body: (
      <p>
        الفيديوهات تُعرض عبر مزوّدين خارجيين، والحصص المباشرة تُستضاف خارج ذروة، فقد تختلف إمكانية الوصول فيها. أخبرنا
        وسنضغط على المزوّد أو نوفّر بديلًا نصيًا حيث يمكن.
      </p>
    ),
  },
  {
    h: "أخبرنا بمشكلة",
    body: (
      <p>
        إن واجهت صعوبة في صفحة أو زر أو اختبار، راسلنا على <Mail /> واذكر الصفحة وما استخدمته (قارئ شاشة، تكبير، لوحة
        مفاتيح). نرد في مدة أقصاها خمسة أيام عمل، ونعالج ما يمنع الاستخدام أولًا. انظر أيضًا{" "}
        <Link href="/terms">الشروط والأحكام</Link>.
      </p>
    ),
  },
];

const en: Section[] = [
  {
    h: "Our target",
    body: (
      <p>
        We aim for WCAG 2.2 AA on the pages we control: lessons, lists, checkout and the account area. This is an
        ongoing commitment, not a certificate, and we fix what we learn about.
      </p>
    ),
  },
  {
    h: "What is in place",
    body: (
      <>
        <ul>
          <li>Every control on the home page is at least 44px, checked by an automated test on every release.</li>
          <li>A visible focus state and a logical keyboard order.</li>
          <li>The system reduce-motion setting is respected.</li>
          <li>Arabic and English text with measured contrast, and full RTL layout.</li>
          <li>Exam, practice and question inputs have names a screen reader can announce.</li>
        </ul>
      </>
    ),
  },
  {
    h: "What we do not control",
    body: (
      <p>
        Video is served by third-party providers, and live sessions are hosted outside Dhirwa, so accessibility there
        can vary. Tell us and we will press the provider or offer a text alternative where we can.
      </p>
    ),
  },
  {
    h: "Report a problem",
    body: (
      <p>
        If a page, a button or a test is hard to use, email <Mail /> with the page and what you were using (screen
        reader, zoom, keyboard). We reply within five working days and fix what blocks use first. See also the{" "}
        <Link href="/terms">terms of use</Link>.
      </p>
    ),
  },
];

export default async function AccessibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === "ar";
  return (
    <LegalPage
      locale={locale}
      title={isAr ? "إمكانية الوصول" : "Accessibility"}
      sections={isAr ? ar : en}
      updated="2026-11-06"
    />
  );
}
