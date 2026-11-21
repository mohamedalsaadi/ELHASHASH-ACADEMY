import { describe, expect, it } from "vitest";
import { completeProfileUrl, missingProfile, needsGrade, profileIncomplete } from "./profile";

const dob = new Date("2008-05-01");
const done = { role: "STUDENT", phone: "+971500000000", gradeId: "g1", dateOfBirth: dob };

describe("missingProfile", () => {
  it("lists what a first Google sign-in still lacks", () => {
    expect(missingProfile({ role: "STUDENT", phone: null, gradeId: null, dateOfBirth: null })).toEqual({ grade: true, dob: true, phone: true });
    expect(missingProfile({ ...done, phone: null })).toEqual({ grade: false, dob: false, phone: true });
  });
  it("has nothing to ask a parent, teacher or admin", () => {
    for (const role of ["PARENT", "INSTRUCTOR", "ADMIN"]) {
      expect(missingProfile({ role, phone: null, gradeId: null, dateOfBirth: null })).toEqual({ grade: false, dob: false, phone: false });
    }
  });
});

describe("needsGrade (the sign-in screen)", () => {
  it("asks only a student with no grade, whatever else is missing", () => {
    expect(needsGrade({ role: "STUDENT", phone: null, gradeId: null, dateOfBirth: null })).toBe(true);
    expect(needsGrade({ ...done, gradeId: null })).toBe(true);
  });
  it("lets a student with a grade browse without a phone or a birth date", () => {
    expect(needsGrade({ ...done, phone: null })).toBe(false);
    expect(needsGrade({ ...done, dateOfBirth: null })).toBe(false);
  });
});

describe("profileIncomplete (cannot buy yet)", () => {
  it("needs a grade, a birth date and a phone", () => {
    expect(profileIncomplete({ ...done, gradeId: null })).toBe(true);
    expect(profileIncomplete({ ...done, dateOfBirth: null })).toBe(true);
    expect(profileIncomplete({ ...done, phone: null })).toBe(true);
  });
  it("passes a finished student and every other role", () => {
    expect(profileIncomplete(done)).toBe(false);
    expect(profileIncomplete({ role: "PARENT", phone: null, gradeId: null, dateOfBirth: null })).toBe(false);
    expect(profileIncomplete({ role: "ADMIN", phone: null, gradeId: null, dateOfBirth: null })).toBe(false);
  });
});

describe("completeProfileUrl", () => {
  it("keeps the page the student was heading to, and asks for the phone only from checkout", () => {
    expect(completeProfileUrl("ar")).toBe("/ar/complete-profile");
    expect(completeProfileUrl("en", "/en/checkout?sku=a&sku=b")).toBe("/en/complete-profile?next=%2Fen%2Fcheckout%3Fsku%3Da%26sku%3Db");
    expect(completeProfileUrl("ar", "/ar/checkout?sku=a", true)).toBe("/ar/complete-profile?next=%2Far%2Fcheckout%3Fsku%3Da&phone=1");
    expect(completeProfileUrl("ar", undefined, true)).toBe("/ar/complete-profile?phone=1");
  });
});
