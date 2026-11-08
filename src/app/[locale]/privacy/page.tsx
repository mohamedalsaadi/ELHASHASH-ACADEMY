import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { SellerLine } from "@/components/SellerLine";
import { Link } from "@/i18n/navigation";
import { PRIVACY_VERSION } from "@/lib/legal";
import { alternates } from "@/lib/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({ title: locale === "ar" ? "سياسة الخصوصية" : "Privacy policy", alternates: alternates(locale, "/privacy") }));
}

const ar: Section[] = [
  {
    h: "من نحن",
    body: (
      <>
        <p>
          ذروة (Dhirwa) منصة تعليمية في الإمارات العربية المتحدة. تشرح هذه السياسة ما نجمعه وكيف نستخدمه. للتواصل بشأن الخصوصية:{" "}
          <Mail />.
        </p>
        <SellerLine locale="ar" />
      </>
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
        VdoCipher (حماية الفيديو)، وResend (البريد). تُفتح الحصص المباشرة عبر رابط يقدّمه المدرّس (Zoom أو Microsoft Teams أو Google Meet)، ويُستضاف الاجتماع خارج ذروة ولا تسجّله. وعند تفعيل التصحيح الآلي لكورس، يُرسل
        نص إجابة الطالب والصور التي يرفعها إلى Google (Gemini) لاقتراح درجة يراجعها المدرّس. وصندوق الاقتراحات مجهول: لا نحفظ اسمًا ولا بريدًا، ونُخفي أرقام الهاتف والبريد داخل النص، ثم يُرسل النص إلى Google (Gemini) ليلخّصه للمالك. لا نبيع بياناتك.
      </p>
    ),
  },
  {
    h: "ملفات الكوكيز",
    body: (
      <p>
        نستخدم كوكيز ضرورية فقط: جلسة تسجيل الدخول، وكوكي الجهاز لتطبيق قاعدة الجهاز الواحد، وكوكي اختيار الدولة، وكوكي اللغة الذي يحفظ لغة الواجهة.
        ونسجّل أحداث استخدام داخلية في قاعدتنا (مثل فتح درس أو إتمام شراء) لقياس ما يعمل وما لا يعمل، مربوطة بحسابك
        أو بمعرّف جهازك. لا نستخدم أي متتبع إعلاني أو خدمة تحليلات من طرف ثالث، ولا نبيع هذه البيانات. وإذا أضفنا
        متتبعًا خارجيًا لاحقًا سنضيف بانر موافقة ونحدّث هذه السياسة.
      </p>
    ),
  },
  {
    h: "مدة الاحتفاظ",
    body: (
      <p>
        نحتفظ ببيانات الحساب أثناء نشاطه، وبسجلات الدفع للمدة التي يفرضها القانون أو المحاسبة. تُحذف أحداث الاستخدام بعد 180 يومًا، ورسائل الدعم بعد 90 يومًا من إغلاق الطلب. يمكنك طلب حذف الحساب في أي وقت.
      </p>
    ),
  },
  {
    h: "الأطفال وولي الأمر",
    body: (
      <p>
        من هم تحت 13 عامًا يشتركون بموافقة ولي الأمر. نطلب تاريخ الميلاد عند التسجيل، وإذا كان الطالب تحت 13 نرسل إلى
        ولي الأمر رسالة واتساب برابط تأكيد واحد؛ بالموافقة يُنشأ حساب ولي الأمر ويُربط بالطالب، فيتابع التقدم والمدفوعات
        ويشاهد الدروس مع ابنه. ونسجّل عنوان IP والدولة عند تشغيل الدروس المسجلة لمنع مشاركة الحسابات.
      </p>
    ),
  },
  {
    h: "حقوقك",
    body: (
      <p>
        يمكنك طلب نسخة من بياناتك أو تصحيحها أو حذفها عبر <Link href="/contact">صفحة التواصل</Link> باختيار موضوع
        «طلب خصوصية». نستهدف الرد خلال 30 يومًا. ويستطيع الطالب وولي الأمر حذف الحساب بأنفسهم من صفحة الحساب.
        تحمل الرسائل الاختيارية (التذكيرات والإجابات وتقارير التقدم) رابطًا لإيقافها، ويمكن إيقافها من صفحة الحساب أيضًا،
        أما إيصالات الدفع ورسائل أمان الحساب فتصلك دائمًا. قد نحتفظ بسجلات الدفع التي يفرض القانون الاحتفاظ بها.
      </p>
    ),
  },
  {
    h: "أين تُعالج البيانات",
    body: (
      <p>
        قاعدة البيانات مستضافة لدى Neon في فرانكفورت بألمانيا، والملفات المرفوعة وإيصالات PDF لدى Vercel في باريس بفرنسا،
        ويعمل الموقع من منطقة دبي. يُرسَل البريد عبر Resend في الولايات المتحدة، ويُشغَّل الفيديو المحمي عبر VdoCipher، وتُعالَج
        طلبات التصحيح الآلي لدى Google في الولايات المتحدة. أي أن بياناتك قد تُعالَج خارج الإمارات. نرسل لكل مزوّد ما يلزمه
        لخدمتك فقط، ونعتمد اتفاقيات معالجة البيانات التي يقدّمها.
      </p>
    ),
  },
  {
    h: "الأساس القانوني",
    body: (
      <p>
        نعالج بياناتك لتنفيذ العقد بيننا (الحساب والدروس والدفع)، وبموافقتك حين تضع علامة في مربع الشروط وسياسة الخصوصية عند
        التسجيل، ويوافق ولي الأمر عمّن هم دون 13 عامًا، وللوفاء بالتزامات قانونية مثل المحاسبة. يمكنك سحب موافقتك في أي وقت
        بحذف حسابك.
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
      <>
        <p>
          ذروة (Dhirwa) is an education platform in the United Arab Emirates. This policy explains what we collect and how we use it.
          For privacy questions: <Mail />.
        </p>
        <SellerLine locale="en" />
      </>
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
        VdoCipher (video protection) and Resend (email). Live lectures open through a link the teacher provides (Zoom, Microsoft Teams or Google Meet); the meeting is hosted outside Dhirwa and Dhirwa does not record it. When automatic grading is switched on
        for a course, the written answer a student submits and any uploaded photos are sent to Google (Gemini) for a suggested
        mark that the teacher reviews. The suggestion box is anonymous: we keep no name or email, mask any phone number or email typed into the text, and send the text to Google (Gemini) to summarise it for the owner. We do not sell your data.
      </p>
    ),
  },
  {
    h: "Cookies",
    body: (
      <p>
        We use strictly necessary cookies only: the sign-in session, the device cookie for the one-device rule, the
        country you picked, and the language cookie that remembers the language of the pages. We also record first-party usage events in our own database (for example a lesson opened or a
        purchase completed) to see what works, tied to your account or your device id. There is no advertising tracker and
        no third-party analytics service, and we do not sell this data. If an external tracker is added later, we will add
        a consent banner and update this policy.
      </p>
    ),
  },
  {
    h: "How long we keep it",
    body: (
      <p>
        Account data is kept while the account is active. Payment records are kept as long as accounting or law requires.
        Behavioural events are deleted after 180 days, and support messages 90 days after the request closes. You can ask to delete
your account at any time.
      </p>
    ),
  },
  {
    h: "Children and parents",
    body: (
      <p>
        Students under 13 join with a guardian&apos;s consent. We ask for a date of birth at sign-up; if the student is under
        13, we send the guardian one WhatsApp message with a confirmation link. Approving it creates the guardian&apos;s parent
        account and links the student, so the parent can follow progress and payments and watch lessons with their child.
        When recorded lessons are played we log the IP address and country to stop account sharing.
      </p>
    ),
  },
  {
    h: "Your rights",
    body: (
      <p>
        You can request a copy of your data, correct it, or delete it through the <Link href="/contact">contact page</Link> by
        choosing the “Privacy request” topic. We aim to reply within 30 days. Students and parents can also delete their own
        account from the account page. Optional emails (reminders, answers and progress notes) carry a link to switch them off,
        and the account page has the same switch. Payment receipts and account security emails always reach you. Some payment
        records must be kept where the law requires it.
      </p>
    ),
  },
  {
    h: "Where data is processed",
    body: (
      <p>
        The database is hosted by Neon in Frankfurt, Germany. Uploaded files and PDF receipts are stored by Vercel in Paris,
        France, and the site runs from Vercel&apos;s Dubai region. Email is sent through Resend in the United States, protected
        video is played through VdoCipher, and automatic-grading requests are processed by Google in the United States. So your
        data may be processed outside the UAE. We send each provider only what it needs to serve you, and we rely on the data
        processing terms each one offers.
      </p>
    ),
  },
  {
    h: "Legal basis",
    body: (
      <p>
        We process your data to carry out the contract between us (your account, lessons and payments), with your consent when
        you tick the terms and privacy policy box at sign-up (a guardian agrees for anyone under 13), and to meet legal duties
        such as accounting. You can withdraw your consent at any time by deleting your account.
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
  return <LegalPage locale={locale} title={isAr ? "سياسة الخصوصية" : "Privacy policy"} sections={isAr ? ar : en} updated={PRIVACY_VERSION} />;
}
