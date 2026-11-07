import { setRequestLocale } from "next-intl/server";
import { LegalPage, Mail, type Section } from "@/components/LegalPage";
import { Link } from "@/i18n/navigation";
import { alternates } from "@/lib/seo";
import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from "@/lib/site";
import { ContactForm } from "./ContactForm";

function Channels() {
  return (
    <div className="grid gap-2">
      <p>
        <Mail />
      </p>
      {SUPPORT_PHONE && <p dir="ltr">{SUPPORT_PHONE}</p>}
      {SUPPORT_WHATSAPP && (
        <p>
          <a href={`https://wa.me/${SUPPORT_WHATSAPP.replace(/\D/g, "")}`} dir="ltr">
            WhatsApp · {SUPPORT_WHATSAPP}
          </a>
        </p>
      )}
    </div>
  );
}

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  return params.then(({ locale }) => ({ title: locale === "ar" ? "تواصل معنا" : "Contact us", alternates: alternates(locale, "/contact") }));
}

const ar: Section[] = [
  {
    h: "القنوات الرسمية",
    body: (
      <>
        <Channels />
        <p>نرد خلال يومي عمل. هذه هي القنوات الرسمية الوحيدة.</p>
      </>
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
        ذروة (Dhirwa)، الإمارات العربية المتحدة. اقرأ أيضًا <Link href="/terms">الشروط والأحكام</Link> و
        <Link href="/refund">سياسة الاسترداد</Link>.
      </p>
    ),
  },
];

const en: Section[] = [
  {
    h: "Official channels",
    body: (
      <>
        <Channels />
        <p>We reply within two business days. These are the only official channels.</p>
      </>
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
        ذروة (Dhirwa), United Arab Emirates. See also the <Link href="/terms">terms of use</Link> and the{" "}
        <Link href="/refund">refund policy</Link>.
      </p>
    ),
  },
];

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const isAr = locale === "ar";
  return (
    <LegalPage numbered={false} locale={locale} title={isAr ? "تواصل معنا" : "Contact us"} sections={isAr ? ar : en}>
      <ContactForm />
    </LegalPage>
  );
}
