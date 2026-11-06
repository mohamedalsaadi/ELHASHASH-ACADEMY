import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { Link } from "@/i18n/navigation";
import { alternates } from "@/lib/seo";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({ title: locale === "ar" ? "سياسة الاسترداد" : "Refund policy", alternates: alternates(locale, "/refund") }));
}

const ar: Section[] = [
  {
    h: "الخلاصة",
    body: (
      <p>
        الباقات محتوى رقمي يُفتح فور إتمام الدفع، لذلك لا نردّ مبلغ باقة فتحتها لمجرد تغيير الرأي. أما إذا حدث خطأ فسياستنا
        أن نردّ المبلغ كاملًا. لا تحدّ هذه السياسة من أي حق يمنحه لك قانون حماية المستهلك المعمول به في بلدك.
      </p>
    ),
  },
  {
    h: "جرّب قبل أن تدفع",
    body: (
      <p>
        الوحدة الأولى من كل مادة مجانية بالكامل. شاهدها قبل الاشتراك لتتأكد أن الشرح يناسبك، وراجع مدة الباقة وتاريخ انتهائها
        في صفحة الدفع.
      </p>
    ),
  },
  {
    h: "الحالات التي نرد فيها المبلغ",
    body: (
      <>
        <p>نرد المبلغ كاملًا في الحالات الآتية:</p>
        <ul>
          <li>إذا خُصم منك المبلغ مرتين لنفس الباقة، نرد المبلغ المكرر.</li>
          <li>إذا تم الدفع ولم تُفتح الباقة في حسابك ولم نتمكن من حل المشكلة خلال 7 أيام من تواصلك معنا.</li>
          <li>إذا كانت الباقة غير متاحة أو تختلف جوهريًا عن الوصف المنشور.</li>
          <li>إذا كانت الدفعة غير مصرّح بها، مثل استخدام بطاقة دون إذن صاحبها.</li>
        </ul>
      </>
    ),
  },
  {
    h: "كيف تطلب ذلك",
    body: (
      <p>
        راسلنا على <Mail /> خلال 30 يومًا من الدفع، واذكر رقم الهاتف أو البريد المسجل به حسابك وتاريخ الدفع. يعود المبلغ إلى
        نفس البطاقة خلال 5 إلى 10 أيام عمل بحسب البنك.
      </p>
    ),
  },
  {
    h: "إيقاف الحساب",
    body: (
      <p>
        إذا أوقفنا حسابًا بسبب مشاركته أو تسجيل الفيديوهات أو نشرها بالمخالفة <Link href="/terms">للشروط والأحكام</Link>، فقد
        نرفض استرداد المبلغ، دون المساس بأي حق يمنحه لك القانون.
      </p>
    ),
  },
];

const en: Section[] = [
  {
    h: "The short version",
    body: (
      <p>
        Packages are digital content that unlocks the moment you pay, so we do not refund a package you have already
        opened simply because you changed your mind. If something went wrong, our policy is to refund in full. Nothing
        here limits any right the consumer-protection law of your country gives you.
      </p>
    ),
  },
  {
    h: "Try before you pay",
    body: (
      <p>
        Unit 1 of every subject is completely free. Watch it before subscribing to make sure the teaching suits you, and
        check the package length and end date on the checkout page.
      </p>
    ),
  },
  {
    h: "When we do refund",
    body: (
      <>
        <p>We refund in full when:</p>
        <ul>
          <li>You were charged twice for the same package: we refund the duplicate charge.</li>
          <li>You paid but the package never unlocked, and we could not fix it within 7 days of you contacting us.</li>
          <li>The package was unavailable, or materially different from what was described.</li>
          <li>The payment was not authorised, for example a card used without permission from its owner.</li>
        </ul>
      </>
    ),
  },
  {
    h: "How to ask",
    body: (
      <p>
        Email <Mail /> within 30 days of paying, with the phone number or email on your account and the payment date. The
        money returns to the same card within 5 to 10 business days, depending on your bank.
      </p>
    ),
  },
  {
    h: "Suspended accounts",
    body: (
      <p>
        If we suspend an account for sharing it, or for recording or publishing the videos in breach of the{" "}
        <Link href="/terms">terms</Link>, we may decline a refund, without affecting any right the law gives you.
      </p>
    ),
  },
];

export default async function RefundPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === "ar";
  return <LegalPage locale={locale} title={isAr ? "سياسة الاسترداد" : "Refund policy"} sections={isAr ? ar : en} />;
}
