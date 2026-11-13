/** Public support channels. Only these survive contact masking in student and teacher text. */
/** Public support address. Mail to it arrives through Resend's inbound webhook and becomes a ticket in /admin/support. */
export const CONTACT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || "support@dhirwa.ae";

export const SUPPORT_PHONE = process.env.SUPPORT_PHONE?.trim() || null;
export const SUPPORT_WHATSAPP = process.env.SUPPORT_WHATSAPP?.trim() || null;
