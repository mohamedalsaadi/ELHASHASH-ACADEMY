// WhatsApp Business Cloud API (Meta). One call: a pre-approved authentication template carrying the code.
// Off until WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN exist; the sign-in page then keeps its password form.

export const whatsappEnabled = () => Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);

/** The template must exist in both languages in Meta's manager, category "Authentication", with a copy-code button. */
const TEMPLATE = () => process.env.WHATSAPP_TEMPLATE || "dhirwa_login_code";
const VERSION = () => process.env.WHATSAPP_API_VERSION || "v21.0";

/** Sends the code; false when WhatsApp refused or could not be reached. `phone` is +<country code><number>. */
export async function sendWhatsAppCode(phone: string, code: string, locale: "ar" | "en"): Promise<boolean> {
  if (!whatsappEnabled()) return false;
  const res = await fetch(`${process.env.WHATSAPP_API_BASE || "https://graph.facebook.com"}/${VERSION()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/\D/g, ""),
      type: "template",
      template: {
        name: TEMPLATE(),
        language: { code: locale },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: code }] },
        ],
      },
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/**
 * Asks a guardian to approve their child's account. The template (category "Utility", WHATSAPP_GUARDIAN_TEMPLATE) takes the
 * child's name as {{1}} and has a URL button ending in {{1}} whose base is https://<site>/<lang>/guardian/confirm?token=
 */
export async function sendWhatsAppGuardianLink(phone: string, childName: string, token: string, locale: "ar" | "en"): Promise<boolean> {
  if (!whatsappEnabled()) return false;
  const res = await fetch(`${process.env.WHATSAPP_API_BASE || "https://graph.facebook.com"}/${VERSION()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone.replace(/\D/g, ""),
      type: "template",
      template: {
        name: process.env.WHATSAPP_GUARDIAN_TEMPLATE || "dhirwa_guardian_consent",
        language: { code: locale },
        components: [
          { type: "body", parameters: [{ type: "text", text: childName }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: token }] },
        ],
      },
    }),
  }).catch(() => null);
  return Boolean(res?.ok);
}
