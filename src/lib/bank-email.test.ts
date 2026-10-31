import { describe, expect, it } from "vitest";
import {
  extractOrderIdCandidates,
  matchBankEmail,
  normalizeCurrency,
  parseAmountToMinor,
  type MatchOrder,
  type ParsedBankEmail,
} from "./bank-email";

const ORDER = "cmvwlf7im0000w47kug2expj9";

const parsed = (over: Partial<ParsedBankEmail> = {}): ParsedBankEmail => ({
  isTransferAlert: true,
  direction: "credit",
  amount: "1,020.00",
  currency: "EGP",
  senderName: "Ahmed Ali",
  senderAccount: "****1234",
  reference: `COURSE ${ORDER}`,
  valueDate: "2026-11-02",
  bankTransactionId: "TX-1",
  transferCount: 1,
  confidence: "high",
  needsReview: false,
  ...over,
});

const order = (over: Partial<MatchOrder> = {}): MatchOrder => ({
  id: ORDER,
  status: "PENDING",
  gateway: "MANUAL",
  currency: "EGP",
  payable: 102000,
  ...over,
});

const body = `Incoming transfer of EGP 1,020.00 from Ahmed Ali. Note: COURSE ${ORDER}`;

const run = (over: Partial<Parameters<typeof matchBankEmail>[0]> = {}) =>
  matchBankEmail({
    parsed: parsed(),
    amountMinor: 102000,
    currency: "EGP",
    orderIds: [ORDER],
    orders: [order()],
    bodyText: body,
    authenticated: true,
    autoApprove: true,
    ...over,
  });

describe("normalizeCurrency", () => {
  it("reads ISO codes and the common Arabic tokens", () => {
    expect(normalizeCurrency("EGP")).toBe("EGP");
    expect(normalizeCurrency("aed")).toBe("AED");
    expect(normalizeCurrency("ج.م")).toBe("EGP");
    expect(normalizeCurrency("د.إ")).toBe("AED");
    expect(normalizeCurrency("ريال سعودي")).toBe("SAR");
  });

  it("refuses anything ambiguous", () => {
    expect(normalizeCurrency("ريال")).toBeNull();
    expect(normalizeCurrency("USD")).toBeNull();
    expect(normalizeCurrency("")).toBeNull();
    expect(normalizeCurrency(null)).toBeNull();
  });
});

describe("parseAmountToMinor", () => {
  it("converts with the currency's exponent", () => {
    expect(parseAmountToMinor("1,250.00", "AED")).toBe(125000);
    expect(parseAmountToMinor("12.500", "KWD")).toBe(12500);
    expect(parseAmountToMinor("990", "EGP")).toBe(99000);
  });

  it("reads Arabic-Indic digits and separators", () => {
    expect(parseAmountToMinor("١٬٢٥٠٫٠٠", "AED")).toBe(125000);
  });

  it("refuses wrong precision, zero, and junk", () => {
    expect(parseAmountToMinor("1,250.999", "EGP")).toBeNull();
    expect(parseAmountToMinor("0", "EGP")).toBeNull();
    expect(parseAmountToMinor("abc", "EGP")).toBeNull();
    expect(parseAmountToMinor(null, "EGP")).toBeNull();
    expect(parseAmountToMinor("100", null)).toBeNull();
  });
});

describe("extractOrderIdCandidates", () => {
  it("finds a cuid inside prose and punctuation", () => {
    expect(extractOrderIdCandidates(`التحويل ${ORDER}.`)).toEqual([ORDER]);
    expect(extractOrderIdCandidates(`note: ${ORDER.toUpperCase()}`)).toEqual([ORDER]);
  });

  it("dedupes and refuses short tokens", () => {
    expect(extractOrderIdCandidates(`${ORDER} ${ORDER}`)).toEqual([ORDER]);
    expect(extractOrderIdCandidates("cmvshort")).toEqual([]);
    expect(extractOrderIdCandidates(null)).toEqual([]);
  });
});

describe("matchBankEmail", () => {
  it("approves only the exact case", () => {
    expect(run()).toEqual({ kind: "approve", orderId: ORDER, amount: 102000, currency: "EGP" });
  });

  it("queues when the transport or sender is not authenticated", () => {
    expect(run({ authenticated: false })).toMatchObject({ kind: "queue", reason: "not_authenticated" });
  });

  it("queues without a reference, because prices repeat", () => {
    expect(run({ orderIds: [], parsed: parsed({ reference: null }) })).toMatchObject({ kind: "queue", reason: "no_reference" });
    expect(run({ orderIds: [ORDER, "cmvwlf7im0000w47kug2expj8"] })).toMatchObject({ kind: "queue", reason: "multiple_references" });
  });

  it("queues on any mismatch", () => {
    expect(run({ amountMinor: 101999 })).toMatchObject({ kind: "queue", reason: "amount_mismatch" });
    expect(run({ currency: "AED" })).toMatchObject({ kind: "queue", reason: "currency_mismatch" });
    expect(run({ orders: [order({ status: "PAID" })] })).toMatchObject({ kind: "queue", reason: "already_paid" });
    expect(run({ orders: [order({ gateway: "STRIPE" })] })).toMatchObject({ kind: "queue", reason: "not_transfer" });
  });

  it("queues when the model reports doubt or several transfers", () => {
    expect(run({ parsed: parsed({ needsReview: true }) })).toMatchObject({ kind: "queue", reason: "low_confidence" });
    expect(run({ parsed: parsed({ confidence: "medium" }) })).toMatchObject({ kind: "queue", reason: "low_confidence" });
    expect(run({ parsed: parsed({ direction: "debit" }) })).toMatchObject({ kind: "queue", reason: "not_credit" });
    expect(run({ parsed: parsed({ transferCount: 2 }) })).toMatchObject({ kind: "queue", reason: "multiple_transfers" });
  });

  it("queues when the model invented a reference or an amount absent from the body", () => {
    expect(run({ parsed: parsed({ reference: `COURSE cmvwlf7im0000w47kug2expj8` }) })).toMatchObject({
      kind: "queue",
      reason: "parse_mismatch",
    });
    expect(run({ parsed: parsed({ amount: "9,999.00" }) })).toMatchObject({ kind: "queue", reason: "parse_mismatch" });
  });

  it("queues while auto-approval is off", () => {
    expect(run({ autoApprove: false })).toMatchObject({ kind: "queue", reason: "auto_disabled" });
  });
});
