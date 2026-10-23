import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hmacString, verifyTransactionHmac, type PaymobTransaction } from "./paymob";

const tx: PaymobTransaction = {
  id: 192036465,
  amount_cents: 76500,
  created_at: "2026-10-24T01:15:22.123456",
  currency: "EGP",
  error_occured: false,
  has_parent_transaction: false,
  integration_id: 4512345,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 217503754, merchant_order_id: "ord_1" },
  owner: 302852,
  pending: false,
  source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
  success: true,
};

describe("Paymob HMAC", () => {
  it("concatenates the callback fields in Paymob's documented order", () => {
    expect(hmacString(tx)).toBe(
      "765002026-10-24T01:15:22.123456EGPfalsefalse1920364654512345truefalsefalsefalsetruefalse217503754302852false2346MasterCardcardtrue",
    );
  });

  it("accepts a valid signature and rejects a tampered amount or a wrong secret", () => {
    const secret = "test-hmac-secret";
    const sig = createHmac("sha512", secret).update(hmacString(tx)).digest("hex");
    expect(verifyTransactionHmac(tx, sig, secret)).toBe(true);
    expect(verifyTransactionHmac({ ...tx, amount_cents: 1 }, sig, secret)).toBe(false);
    expect(verifyTransactionHmac(tx, sig, "other")).toBe(false);
    expect(verifyTransactionHmac(tx, "not-hex", secret)).toBe(false);
  });
});
