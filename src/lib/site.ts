/** Public support channels. Only these survive contact masking in student and teacher text. */
/** Public support address. Set SUPPORT_EMAIL once the branded domain has a mailbox. */
export const CONTACT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || "chemical.mohammed@gmail.com";

export const SUPPORT_PHONE = process.env.SUPPORT_PHONE?.trim() || null;
export const SUPPORT_WHATSAPP = process.env.SUPPORT_WHATSAPP?.trim() || null;
