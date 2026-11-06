import { describe, expect, it } from "vitest";
import { resolveBeneficiary } from "./checkout-beneficiary";

const base = { buyerId: "parent-1", linkedStudentIds: [] as string[], studentIdByPhone: null as string | null };
const now = new Date("2026-11-06T10:00:00Z");

describe("resolveBeneficiary", () => {
  it("leaves a student's own purchase alone", () => {
    expect(resolveBeneficiary({ ...base, role: "STUDENT" })).toEqual({ ok: true, beneficiaryId: null, declaredAt: null });
  });

  it("refuses a student naming a beneficiary", () => {
    expect(resolveBeneficiary({ ...base, role: "STUDENT", forStudentId: "s1" })).toEqual({ ok: false, error: "invalid_request" });
  });

  it("accepts a linked child", () => {
    const r = resolveBeneficiary({ ...base, role: "PARENT", forStudentId: "s1", linkedStudentIds: ["s1"] });
    expect(r).toEqual({ ok: true, beneficiaryId: "s1", declaredAt: null });
  });

  it("refuses an unlinked child id", () => {
    const r = resolveBeneficiary({ ...base, role: "PARENT", forStudentId: "s1", linkedStudentIds: ["s2"] });
    expect(r).toEqual({ ok: false, error: "child_required" });
  });

  it("requires the guardian declaration for the phone path", () => {
    const r = resolveBeneficiary({ ...base, role: "PARENT", forStudentPhone: "0501234567", studentIdByPhone: "s1" });
    expect(r).toEqual({ ok: false, error: "attestation_required" });
  });

  it("accepts a registered student after the declaration and records when it was made", () => {
    const r = resolveBeneficiary({
      ...base,
      role: "PARENT",
      forStudentPhone: "0501234567",
      studentIdByPhone: "s1",
      guardianAttestation: true,
      now,
    });
    expect(r).toEqual({ ok: true, beneficiaryId: "s1", declaredAt: now });
  });

  it("refuses a phone with no student account", () => {
    const r = resolveBeneficiary({ ...base, role: "PARENT", forStudentPhone: "0501234567", guardianAttestation: true });
    expect(r).toEqual({ ok: false, error: "child_not_found" });
  });

  it("refuses the buyer's own account", () => {
    const r = resolveBeneficiary({
      ...base,
      role: "PARENT",
      forStudentPhone: "0501234567",
      studentIdByPhone: "parent-1",
      guardianAttestation: true,
    });
    expect(r).toEqual({ ok: false, error: "child_not_found" });
  });

  it("asks for a child when the parent supplies neither", () => {
    expect(resolveBeneficiary({ ...base, role: "PARENT" })).toEqual({ ok: false, error: "child_required" });
  });
});
