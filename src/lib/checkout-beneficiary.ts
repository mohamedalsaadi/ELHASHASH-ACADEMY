/**
 * Who receives the access an order buys. Kept pure so the checkout route and its tests share the
 * same rules: a parent may buy for a linked child, or for a registered student found by phone
 * after declaring guardianship. Paying never grants the parent visibility into the student.
 */
export type BeneficiaryInput = {
  role: string;
  buyerId: string;
  forStudentId?: string;
  forStudentPhone?: string;
  guardianAttestation?: boolean;
  /** ParentLink rows for this parent, already narrowed to forStudentId when one was supplied. */
  linkedStudentIds: string[];
  /** The student who owns the phone, or null when no STUDENT does. */
  studentIdByPhone: string | null;
  now?: Date;
};

export type BeneficiaryResult =
  | { ok: true; beneficiaryId: string | null; declaredAt: Date | null }
  | { ok: false; error: "child_required" | "child_not_found" | "attestation_required" | "invalid_request" };

export function resolveBeneficiary(input: BeneficiaryInput): BeneficiaryResult {
  if (input.role !== "PARENT") {
    if (input.forStudentId || input.forStudentPhone) return { ok: false, error: "invalid_request" };
    return { ok: true, beneficiaryId: null, declaredAt: null };
  }

  if (input.forStudentId) {
    return input.linkedStudentIds.includes(input.forStudentId)
      ? { ok: true, beneficiaryId: input.forStudentId, declaredAt: null }
      : { ok: false, error: "child_required" };
  }

  if (input.forStudentPhone) {
    if (!input.guardianAttestation) return { ok: false, error: "attestation_required" };
    const id = input.studentIdByPhone;
    if (!id || id === input.buyerId) return { ok: false, error: "child_not_found" };
    return { ok: true, beneficiaryId: id, declaredAt: input.now ?? new Date() };
  }

  return { ok: false, error: "child_required" };
}
