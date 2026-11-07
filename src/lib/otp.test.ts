import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "unit-test-secret";
});

describe("proof", () => {
  it("speaks for the phone it was made for, until it expires", async () => {
    const { signProof, readProof, PROOF_TTL_MS } = await import("./otp");
    const proof = signProof("+971501234567", 1_000);
    expect(readProof(proof, 2_000)).toBe("+971501234567");
    expect(readProof(proof, 1_000 + PROOF_TTL_MS + 1)).toBeNull();
  });
  it("refuses a proof whose phone or signature was changed", async () => {
    const { signProof, readProof } = await import("./otp");
    const [body, sig] = signProof("+971501234567").split(".");
    const forged = Buffer.from(Buffer.from(body, "base64url").toString().replace("+971501234567", "+971509999999")).toString("base64url");
    expect(readProof(`${forged}.${sig}`)).toBeNull();
    expect(readProof(`${body}.${"0".repeat(64)}`)).toBeNull();
    expect(readProof("nonsense")).toBeNull();
  });
});

describe("hashCode", () => {
  it("depends on both the phone and the code", async () => {
    const { hashCode } = await import("./otp");
    expect(hashCode("+971501234567", "123456")).toBe(hashCode("+971501234567", "123456"));
    expect(hashCode("+971501234567", "123456")).not.toBe(hashCode("+971501234567", "123457"));
    expect(hashCode("+971501234567", "123456")).not.toBe(hashCode("+971509999999", "123456"));
  });
});
