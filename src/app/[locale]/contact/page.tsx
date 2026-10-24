import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { Link } from "@/i18n/navigation";

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({ title: locale === "ar" ? "تواصل معنا" : "Contact us" }));
}

const ar: Section[] = [
  {
    h: "البريد الإلكتروني",
    body: (
      <p>
        <Mail />
        <br />
        نرد خلال يومي عمل.
      </p>
    ),
  },
  {
    h: "لنساعدك أسرع",
    body: (
      <ul>
        <li>رقم الهاتف أو البريد المسجل به حسابك.</li>
        <li>المادة أو الدرس المقصود.</li>
        <li>لمشاكل الدفع: تاريخ الدفع وآخر 4 أرقام من البطاقة. لا ترسل رقم البطاقة كاملًا أبدًا.</li>
      </ul>
    ),
  },
  {
    h: "الجهة المقدمة للخدمة",
    body: (
      <p>
        أكاديمية السعدي، الإمارات العربية المتحدة. اقرأ أيضًا <Link href="/terms">الشروط والأحكام</Link> و
        <Link href="/refund">سياسة الاسترداد</Link>.
      </p>
    ),
  },
];

const en: Section[] = [
  {
    h: "Email",
    body: (
      <p>
        <Mail />
        <br />
        We reply within two business days.
      </p>
    ),
  },
  {
    h: "Help us help you faster",
    body: (
      <ul>
        <li>The phone number or email on your account.</li>
        <li>The subject or lesson you mean.</li>
        <li>For payment problems: the payment date and the last 4 digits of the card. Never send the full card number.</li>
      </ul>
    ),
  },
  {
    h: "Service provider",
    body: (
      <p>
        Alsaadi Academy, United Arab Emirates. See also the <Link href="/terms">terms of use</Link> and the{" "}
        <Link href="/refund">refund policy</Link>.
      </p>
    ),
  },
];

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === "ar";
  return <LegalPage locale={locale} title={isAr ? "تواصل معنا" : "Contact us"} sections={isAr ? ar : en} />;
}
