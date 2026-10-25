import { describe, expect, it } from "vitest";
import { maskContacts } from "./contact-guard";

describe("maskContacts", () => {
  it.each(["01012345678", "0101 234 5678", "+201012345678", "0020 101 234 5678", "0501234567", "+966 50 123 4567"])(
    "masks the phone number %s",
    (phone) => {
      const s = maskContacts(`اتصل بي ${phone}`);
      expect(s.masked).toBe(true);
      expect(s.kinds).toContain("phone");
      expect(s.text).toContain("•••");
      expect(s.text).not.toContain(phone);
    },
  );

  it("masks Arabic-Indic digits", () => {
    const s = maskContacts("رقمي ٠١٠١٢٣٤٥٦٧٨");
    expect(s.masked).toBe(true);
    expect(s.text).not.toMatch(/[٠-٩]/);
  });

  it("masks WhatsApp, Telegram and social links", () => {
    for (const link of ["wa.me/201012345678", "https://t.me/teacher", "instagram.com/teacher", "snapchat.com/add/x"]) {
      expect(maskContacts(`هنا ${link}`).text, link).not.toContain(link);
    }
  });

  it("masks emails and @handles", () => {
    const s = maskContacts("راسلني على student@example.com أو @teacher_1");
    expect(s.text).not.toContain("student@example.com");
    expect(s.text).not.toContain("@teacher_1");
    expect(s.kinds).toEqual(expect.arrayContaining(["email", "handle"]));
  });

  it("keeps the academy's own email and allowed numbers", () => {
    const s = maskContacts("راسلونا على chemical.mohammed@gmail.com أو 01012345678", ["01012345678"]);
    expect(s.masked).toBe(false);
    expect(s.text).toContain("chemical.mohammed@gmail.com");
    expect(s.text).toContain("01012345678");
  });

  it("does not touch arithmetic, decimals, prices or years", () => {
    for (const text of ["2+2=4", "3.14", "12,500 جنيه", "2026", "احسب 5000000", "x^2 + 3x = 0"]) {
      expect(maskContacts(text).masked, text).toBe(false);
    }
  });

  it("leaves ordinary text and mixed content intact around the mask", () => {
    const s = maskContacts("سؤالي عن الدرس 3، رقمي 01012345678");
    expect(s.text).toBe("سؤالي عن الدرس 3، رقمي •••");
    expect(s.kinds).toEqual(["phone"]);
  });
});
