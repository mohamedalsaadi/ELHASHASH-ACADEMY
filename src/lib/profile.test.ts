import { describe, expect, it } from "vitest";
import { completeProfileUrl, profileIncomplete } from "./profile";

describe("profileIncomplete", () => {
  it("flags a student missing a phone or a grade (a first Google sign-in)", () => {
    expect(profileIncomplete({ role: "STUDENT", phone: null, gradeId: null })).toBe(true);
    expect(profileIncomplete({ role: "STUDENT", phone: "+971500000000", gradeId: null })).toBe(true);
    expect(profileIncomplete({ role: "STUDENT", phone: null, gradeId: "g1" })).toBe(true);
  });

  it("passes a finished student and every other role", () => {
    expect(profileIncomplete({ role: "STUDENT", phone: "+971500000000", gradeId: "g1" })).toBe(false);
    expect(profileIncomplete({ role: "PARENT", phone: null, gradeId: null })).toBe(false);
    expect(profileIncomplete({ role: "INSTRUCTOR", phone: null, gradeId: null })).toBe(false);
    expect(profileIncomplete({ role: "ADMIN", phone: null, gradeId: null })).toBe(false);
  });
});

describe("completeProfileUrl", () => {
  it("keeps the page the student was heading to", () => {
    expect(completeProfileUrl("ar")).toBe("/ar/complete-profile");
    expect(completeProfileUrl("en", "/en/checkout?sku=a&sku=b")).toBe("/en/complete-profile?next=%2Fen%2Fcheckout%3Fsku%3Da%26sku%3Db");
  });
});
