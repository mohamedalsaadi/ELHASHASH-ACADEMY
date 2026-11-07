import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { Link } from "@/i18n/navigation";
import { alternates } from "@/lib/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({ title: locale === "ar" ? "الأسئلة الشائعة" : "Frequently asked questions", alternates: alternates(locale, "/faq") }));
}

const ar: Section[] = [
  {
    h: "كيف تعمل الباقات؟",
    body: (
      <p>
        اشتراك الفصل يفتح دروس الفصل، والاشتراك الشهري يفتح دروس الشهر، واستئجار الدرس يفتح درسًا واحدًا لعدد أيام محدد.
        يظل الوصول متاحًا حتى تاريخ الانتهاء الظاهر عند الشراء.
      </p>
    ),
  },
  {
    h: "هل يمكنني المشاهدة على أكثر من جهاز؟",
    body: <p>الحساب يعمل على جهاز واحد في نفس الوقت. فتح الحساب على جهاز جديد يوقف التشغيل على الجهاز السابق.</p>,
  },
  {
    h: "هل يمكنني استرداد المبلغ؟",
    body: (
      <p>
        راجع <Link href="/refund">سياسة الاسترداد</Link>. جميع المبيعات نهائية إلا في الحالات الاستثنائية المكتوبة هناك.
      </p>
    ),
  },
  {
    h: "كيف تعمل الحصص المباشرة؟",
    body: (
      <p>
        الحصص المباشرة مشمولة في اشتراك الفصل أو السنة، ويمكن شراء مقعد لحصة واحدة. يفتح الرابط قبل البدء بعشر دقائق
        للطالب، ويحتاج اتصالًا بالإنترنت.
      </p>
    ),
  },
  {
    h: "هل يمكنني سؤال المعلم؟",
    body: <p>الأسئلة متاحة مع الاشتراك الشهري والفصلي، حتى 5 أسئلة يوميًا، ويجيب المعلم تحت الدرس.</p>,
  },
  {
    h: "هل يستطيع ولي الأمر متابعة التقدم؟",
    body: (
      <p>
        نعم. ينشئ الطالب رمزًا من حسابه، ويربط ولي الأمر الحساب به. يرى ولي الأمر المواد النشطة، الحصص المكتملة، حضور
        الحصص المباشرة، والمدفوعات.
      </p>
    ),
  },
  {
    h: "ما طرق الدفع؟",
    body: (
      <p>
        بطاقة بنكية أو Apple Pay أو Google Pay عبر Ziina، بالدرهم الإماراتي. لا نحتفظ ببيانات بطاقتك.
      </p>
    ),
  },
  {
    h: "هل تقدمون شهادات؟",
    body: <p>لا نقدم شهادات معتمدة في الوقت الحالي. نركز على الدروس والحصص المباشرة والأسئلة والتقدم.</p>,
  },
  {
    h: "كيف أثبّت التطبيق؟",
    body: (
      <p>
        من متصفح الهاتف، اختر «إضافة إلى الشاشة الرئيسية» أو زر التثبيت. الفيديوهات والحصص المباشرة تحتاج اتصالًا
        بالإنترنت. لأي مشكلة: <Mail />.
      </p>
    ),
  },
];

const en: Section[] = [
  {
    h: "How do plans work?",
    body: (
      <p>
        A semester plan opens the term&apos;s lessons, a monthly plan opens one month, and a rental opens one lecture for a set
        number of days. Access lasts until the end date shown at purchase.
      </p>
    ),
  },
  {
    h: "Can I watch on more than one device?",
    body: <p>An account plays on one device at a time. Starting on a new device stops playback on the previous one.</p>,
  },
  {
    h: "Can I get a refund?",
    body: (
      <p>
        See the <Link href="/refund">refund policy</Link>. All sales are final except the written exceptions.
      </p>
    ),
  },
  {
    h: "How do live lectures work?",
    body: (
      <p>
        Live lectures are included in term and yearly plans, and a single seat can be bought. The room opens 10 minutes early
        for students and needs an internet connection.
      </p>
    ),
  },
  {
    h: "Can I ask the teacher?",
    body: <p>Questions come with monthly and semester plans, up to 5 a day, and the teacher answers under the lesson.</p>,
  },
  {
    h: "Can a parent follow progress?",
    body: (
      <p>
        Yes. The student generates a code in their account and the parent links to it. The parent sees active courses,
        completed lessons, live attendance and payments.
      </p>
    ),
  },
  {
    h: "What payment methods are there?",
    body: (
      <p>
        Card, Apple Pay or Google Pay through Ziina, in UAE dirhams. We never store your card details.
      </p>
    ),
  },
  {
    h: "Do you issue certificates?",
    body: <p>Not at this time. We focus on lessons, live sessions, questions and progress.</p>,
  },
  {
    h: "How do I install the app?",
    body: (
      <p>
        In your phone browser, choose “Add to Home Screen” or the install button. Videos and live sessions need a connection.
        For any problem: <Mail />.
      </p>
    ),
  },
];

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === "ar";
  return <LegalPage numbered={false} locale={locale} title={isAr ? "الأسئلة الشائعة" : "Frequently asked questions"} sections={isAr ? ar : en} />;
}
