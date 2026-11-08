import { appUrl, emailLayout, sendMail } from "@/lib/mail";
import { sendWhatsAppGuardianLink, whatsappEnabled } from "@/lib/whatsapp";

/** True when the consent link will go only to the guardian's WhatsApp, so opening it proves they hold that number. */
export const guardianViaWhatsApp = () => whatsappEnabled();

/**
 * Sends the consent link. With WhatsApp on it goes only to the guardian's number (an email would let the child
 * approve for themselves); with WhatsApp off the optional email is the fallback. Returns whether anything was sent.
 */
export async function sendGuardianRequest(a: {
  childName: string;
  guardianPhone: string;
  guardianEmail?: string | null;
  token: string;
  locale: "ar" | "en";
}): Promise<boolean> {
  if (guardianViaWhatsApp()) return sendWhatsAppGuardianLink(a.guardianPhone, a.childName, a.token, a.locale);
  if (!a.guardianEmail) return false;
  const ar = a.locale === "ar";
  await sendMail({
    to: a.guardianEmail,
    subject: ar ? "تأكيد موافقة ولي الأمر" : "Confirm your consent for a Dhirwa account",
    html: emailLayout(
      ar ? "تأكيد موافقة ولي الأمر" : "Confirm your consent",
      [ar ? `أنشأ ${a.childName} حسابًا على ذروة بموافقتك. اضغط الرابط لتأكيد موافقتك على استخدام المنصة.` : `${a.childName} created a Dhirwa account with your consent. Open the link to confirm that you agree to them using the platform.`],
      { href: `${appUrl()}/${a.locale}/guardian/confirm?token=${a.token}`, label: ar ? "تأكيد الموافقة" : "Confirm consent" },
      ar ? "ar" : "en",
    ),
  }).catch(() => {});
  return true;
}
