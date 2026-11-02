import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { Link } from "@/i18n/navigation";
import { alternates } from "@/lib/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({ title: locale === "ar" ? "سياسة الخصوصية" : "Privacy policy", alternates: alternates(locale, "/privacy") }));
}

const ar: Section[] = [
  {
    h: "من نحن",
    body: (
      <p>
        ذروة (Dhirwa) منصة تعليمية في الإمارات العربية المتحدة. تشرح هذه السياسة ما نجمعه وكيف نستخدمه. للتواصل بشأن الخصوصية:{" "}
        <Mail />.
      </p>
    ),
  },
  {
    h: "البيانات التي نجمعها",
    body: (
      <ul>
        <li>بيانات الحساب: الاسم، رقم الموبايل، البريد الإلكتروني، الصف، وكود ربط ولي الأمر.</li>
        <li>بيانات الدفع: العملة والمبلغ ومرجع العملية من Ziina. لا نحتفظ برقم البطاقة.</li>
        <li>بيانات الاستخدام: الدرجات المكتملة، الإجابات والأسئلة، حضور الحصص المباشرة، والجهاز وعنوان IP لحماية الدروس.</li>
        <li>رسائل الدعم التي ترسلها إلينا.</li>
      </ul>
    ),
  },
  {
    h: "لماذا نستخدمها",
    body: (
      <ul>
        <li>تقديم الدروس والاشتراكات والحصص المباشرة.</li>
        <li>إتمام المدفوعات وإصدار الإيصالات.</li>
        <li>حماية الحساب وتطبيق سياسة الجهاز الواحد.</li>
        <li>الرد على الأسئلة والدعم، والوفاء بالالتزامات القانونية.</li>
      </ul>
    ),
  },
  {
    h: "من يعالج البيانات",
    body: (
      <p>
        نستخدم مزودين يعالجون البيانات نيابة عنا: Neon (قاعدة البيانات)، Vercel (الاستضافة)، Ziina (الدفع)،
        VdoCipher (حماية الفيديو)، Resend (البريد)، وDaily (الحصص المباشرة). لا نبيع بياناتك.
      </p>
    ),
  },
  {
    h: "ملفات الكوكيز",
    body: (
      <p>
        نستخدم كوكيز ضرورية فقط: جلسة تسجيل الدخول، وكوكي الجهاز لتطبيق قاعدة الجهاز الواحد. لا نستخدم إعلانات أو
        تحليلات الآن، لذلك لا نعرض بانر موافقة. إذا أضفنا تحليلات لاحقًا سنضيف البانر ونحدّث هذه السياسة.
      </p>
    ),
  },
  {
    h: "مدة الاحتفاظ",
    body: (
      <p>
        نحتفظ ببيانات الحساب أثناء نشاطه، وبسجلات الدفع للمدة التي يفرضها القانون أو المحاسبة. تُحذف رسائل الدعم
        بعد معالجتها، أو تُجهَّل عند طلب الحذف. يمكنك طلب حذف الحساب في أي وقت.
      </p>
    ),
  },
  {
    h: "الأطفال وولي الأمر",
    body: (
      <p>
        من هم تحت 18 عامًا يشتركون بموافقة ولي الأمر. يستطيع ولي الأمر إنشاء حساب ومتابعة التقدم والمدفوعات بعد ربط
        الطالب بكود يصدره الطالب من حسابه.
      </p>
    ),
  },
  {
    h: "حقوقك",
    body: (
      <p>
        يمكنك طلب نسخة من بياناتك أو تصحيحها أو حذفها عبر <Link href="/contact">صفحة التواصل</Link> باختيار موضوع
        «طلب خصوصية». نستهدف الرد خلال 30 يومًا. قد نحتفظ بسجلات الدفع التي يفرض القانون الاحتفاظ بها.
      </p>
    ),
  },
  {
    h: "التغييرات",
    body: <p>قد نحدّث هذه السياسة وننشر التاريخ الجديد أعلى الصفحة. استمرارك في استخدام الموقع يعني موافقتك على النسخة المحدثة.</p>,
  },
];

const en: Section[] = [
  {
    h: "Who we are",
    body: (
      <p>
        ذروة (Dhirwa) is an education platform in the United Arab Emirates. This policy explains what we collect and how we use it.
        For privacy questions: <Mail />.
      </p>
    ),
  },
  {
    h: "What we collect",
    body: (
      <ul>
        <li>Account data: name, mobile number, email, grade, and the parent-link code.</li>
        <li>Payment data: currency, amount, and the transaction reference from Ziina. We never store card numbers.</li>
        <li>Usage data: completed lessons, questions and answers, live-session attendance, and the device/IP used for the one-device guard.</li>
        <li>Support messages you send us.</li>
      </ul>
    ),
  },
  {
    h: "Why we use it",
    body: (
      <ul>
        <li>To deliver lessons, subscriptions and live sessions.</li>
        <li>To take payments and issue receipts.</li>
        <li>To protect accounts and enforce the one-device rule.</li>
        <li>To answer support questions and meet legal obligations.</li>
      </ul>
    ),
  },
  {
    h: "Who processes it",
    body: (
      <p>
        We use providers that process data on our behalf: Neon (database), Vercel (hosting), Ziina (payments),
        VdoCipher (video protection), Resend (email), and Daily (live sessions). We do not sell your data.
      </p>
    ),
  },
  {
    h: "Cookies",
    body: (
      <p>
        We use strictly necessary cookies only: the sign-in session and the device cookie for the one-device rule. There is no
        advertising or analytics today, so there is no consent banner. If analytics is added later, we will add the banner and
        update this policy.
      </p>
    ),
  },
  {
    h: "How long we keep it",
    body: (
      <p>
        Account data is kept while the account is active. Payment records are kept as long as accounting or law requires.
        Support messages are deleted after handling, or anonymised on a deletion request. You can ask to delete your account at
        any time.
      </p>
    ),
  },
  {
    h: "Children and parents",
    body: (
      <p>
        Students under 18 join with a guardian&apos;s consent. A parent can create an account and follow progress and payments
        after linking the student with a code the student generates in their account.
      </p>
    ),
  },
  {
    h: "Your rights",
    body: (
      <p>
        You can request a copy of your data, correct it, or delete it through the <Link href="/contact">contact page</Link> by
        choosing the “Privacy request” topic. We aim to reply within 30 days. Some payment records must be kept where the law
        requires it.
      </p>
    ),
  },
  {
    h: "Changes",
    body: <p>We may update this policy and will show the new date at the top of the page. Continuing to use the site means you accept the updated version.</p>,
  },
];

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === "ar";
  return <LegalPage locale={locale} title={isAr ? "سياسة الخصوصية" : "Privacy policy"} sections={isAr ? ar : en} />;
}
