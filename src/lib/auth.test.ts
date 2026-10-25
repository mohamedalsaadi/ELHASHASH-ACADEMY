import { describe, expect, it } from "vitest";
import { phoneSchema, signUpSchema } from "./schemas/auth";

describe("phoneSchema", () => {
  it.each(["01012345678", "01112345678", "0501234567", "51234567", "31234567", "66123456", "71234567"])(
    "accepts the local mobile %s",
    (phone) => {
      expect(phoneSchema.safeParse(phone).success).toBe(true);
    },
  );

  it.each(["1234567", "0612345678", "0101234567", "phone", "+201012345678"])("rejects %s", (phone) => {
    expect(phoneSchema.safeParse(phone).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  const base = { name: "طالب", phone: "01012345678", password: "password123", gradeId: "g1" };

  it("requires a valid email and lowercases it", () => {
    const r = signUpSchema.safeParse({ ...base, email: "Student@Example.COM" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("student@example.com");
  });

  it("rejects a missing or malformed email", () => {
    expect(signUpSchema.safeParse(base).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });
});
