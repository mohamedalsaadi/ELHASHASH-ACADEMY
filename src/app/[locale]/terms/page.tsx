import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { Link } from "@/i18n/navigation";
import { alternates } from "@/lib/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({ title: locale === "ar" ? "الشروط والأحكام" : "Terms of use", alternates: alternates(locale, "/terms") }));
}

const ar: Section[] = [
  {
    h: "من نحن",
    body: (
      <p>
        AAcademy منصة تعليمية في الإمارات العربية المتحدة تقدم شروحات فيديو للمناهج الدراسية. باستخدامك للموقع أو شرائك
        لأي باقة فأنت توافق على هذه الشروط. للتواصل: <Mail />.
      </p>
    ),
  },
  {
    h: "حسابك",
    body: (
      <ul>
        <li>الحساب شخصي لطالب واحد، ويجب أن تكون بياناتك صحيحة.</li>
        <li>يمكن مشاهدة الفيديوهات على جهاز واحد في نفس الوقت. التشغيل على جهاز جديد يوقف الجهاز السابق.</li>
        <li>أنت مسؤول عن سرية كلمة المرور. إذا كان عمرك أقل من 18 عامًا فيجب أن يوافق ولي أمرك على الاشتراك.</li>
      </ul>
    ),
  },
  {
    h: "الباقات والدفع",
    body: (
      <ul>
        <li>
          الأسعار بعملة بلدك كما تظهر في صفحة الدفع (سبع عملات: الجنيه المصري، الريال السعودي، الدرهم الإماراتي، الدينار
          الكويتي، الريال القطري، الدينار البحريني، الريال العماني). الدفع عبر Stripe أو Paymob: بطاقة، محفظة موبايل، كاش في
          منفذ، أو تقسيط valU. لا نحتفظ ببيانات بطاقتك.
        </li>
        <li>كل باقة تفتح مادة محددة حتى تاريخ الانتهاء المكتوب عند الشراء (فصل دراسي، سنة كاملة، أو مراجعة نهائية).</li>
        <li>
          جميع المبيعات نهائية، وتفاصيل الحالات الاستثنائية في <Link href="/refund">سياسة الاسترداد</Link>.
        </li>
      </ul>
    ),
  },
  {
    h: "استخدام المحتوى",
    body: (
      <p>
        تحصل على حق شخصي غير قابل للتحويل لمشاهدة المحتوى للدراسة فقط. يُمنع تسجيل الفيديوهات أو تنزيلها أو نسخها أو بيعها
        أو نشرها أو مشاركة الحساب. الفيديوهات تحمل علامة مائية باسمك، ويحق لنا إيقاف أي حساب يخالف ذلك دون رد المبلغ.
      </p>
    ),
  },
  {
    h: "التواصل داخل المنصة",
    body: (
      <p>
        الأسئلة والإجابات وأسماء الحسابات والدردشة داخل الحصص المباشرة للتواصل التعليمي فقط. لا تشارك أرقام الهواتف أو روابط
        واتساب أو تيليجرام أو حسابات التواصل الاجتماعي. قد نخفي هذه البيانات تلقائيًا، والقنوات الرسمية للتواصل هي المذكورة في
        صفحة <Link href="/contact">تواصل معنا</Link>.
      </p>
    ),
  },
  {
    h: "المحتوى والخدمة",
    body: (
      <p>
        نعمل على تحديث المحتوى وتحسينه، وقد نعدّل ترتيب الدروس أو نضيف إليها. نسعى لأن يكون الموقع متاحًا دائمًا، لكن قد
        يتوقف أحيانًا للصيانة أو لأسباب خارجة عن إرادتنا. الشرح يساعدك على الاستعداد ولا يضمن درجة معينة في الامتحان.
      </p>
    ),
  },
  {
    h: "حدود المسؤولية",
    body: <p>في جميع الأحوال لا تتجاوز مسؤوليتنا تجاهك المبلغ الذي دفعته مقابل الباقة المعنية.</p>,
  },
  {
    h: "القانون والتعديلات",
    body: (
      <p>
        تخضع هذه الشروط لقوانين دولة الإمارات العربية المتحدة. قد نحدّث الشروط، وننشر التاريخ الجديد في أعلى هذه الصفحة،
        واستمرارك في استخدام الموقع بعد التحديث يعني موافقتك عليه.
      </p>
    ),
  },
];

const en: Section[] = [
  {
    h: "Who we are",
    body: (
      <p>
        AAcademy is an education platform in the United Arab Emirates offering video lessons for school
        curricula. By using the site or buying any package you agree to these terms. Contact: <Mail />.
      </p>
    ),
  },
  {
    h: "Your account",
    body: (
      <ul>
        <li>An account is personal to one student, and your details must be accurate.</li>
        <li>Videos play on one device at a time. Starting playback on a new device stops the previous one.</li>
        <li>You keep your password private. If you are under 18, a parent or guardian must agree to the purchase.</li>
      </ul>
    ),
  },
  {
    h: "Packages and payment",
    body: (
      <ul>
        <li>
          Prices are in your country&apos;s currency as shown at checkout (seven currencies: EGP, SAR, AED, KWD, QAR, BHD,
          OMR). Payment is handled by Stripe or Paymob: card, mobile wallet, cash at a kiosk, or valU instalments. We never
          store your card.
        </li>
        <li>Each package unlocks one subject until the end date shown at purchase (semester, full year or final revision).</li>
        <li>
          All sales are final; the exceptions are in the <Link href="/refund">refund policy</Link>.
        </li>
      </ul>
    ),
  },
  {
    h: "Using the content",
    body: (
      <p>
        You get a personal, non-transferable right to watch the content for your own study. Recording, downloading,
        copying, selling or publishing the videos, or sharing your account, is not allowed. Videos carry a watermark with
        your name, and we may suspend any account that breaks these rules without a refund.
      </p>
    ),
  },
  {
    h: "Contact inside the platform",
    body: (
      <p>
        Questions, answers, account names and chat inside live lectures are for learning only. Do not share phone numbers,
        WhatsApp or Telegram links, or social handles. We may hide such details automatically; the official channels are
        the ones listed on the <Link href="/contact">contact page</Link>.
      </p>
    ),
  },
  {
    h: "Content and service",
    body: (
      <p>
        We keep improving the content and may reorder or add lessons. We aim to keep the site available at all times, but
        it may pause for maintenance or reasons outside our control. The lessons help you prepare; they do not guarantee
        a particular exam result.
      </p>
    ),
  },
  {
    h: "Limit of liability",
    body: <p>In every case, our liability to you is limited to the amount you paid for the package concerned.</p>,
  },
  {
    h: "Law and changes",
    body: (
      <p>
        These terms are governed by the laws of the United Arab Emirates. We may update them and will show the new date at
        the top of this page; using the site after an update means you accept it.
      </p>
    ),
  },
];

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === "ar";
  return <LegalPage locale={locale} title={isAr ? "الشروط والأحكام" : "Terms of use"} sections={isAr ? ar : en} updated="2026-10-25" />;
}
