import { describe, expect, it } from "vitest";
import { intentCandidates, refundIdFor } from "./ziina-format";

describe("intentCandidates", () => {
  it("finds a nested intent id and prefers keys that mention intent", () => {
    const body = JSON.stringify({
      event: "payment_intent.status.updated",
      data: { payment_intent_id: "pi_1234567890abcdef", status: "completed", venue: "ziina" },
    });
    expect(intentCandidates(body)).toContain("pi_1234567890abcdef");
  });

  it("accepts a short id when its key names an intent", () => {
    expect(intentCandidates(JSON.stringify({ data: { intent_id: "pi_abc123" } }))).toEqual(["pi_abc123"]);
  });

  it("accepts a UUID and ignores prose and short strings", () => {
    const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
    expect(intentCandidates(JSON.stringify({ id }))).toEqual([id]);
    expect(intentCandidates(JSON.stringify({ note: "thank you", n: 3 }))).toEqual([]);
  });

  it("dedupes, caps the list, and survives invalid JSON", () => {
    const body = JSON.stringify({ a: "pi_aaaaaaaaaaaaaaaa", b: "pi_aaaaaaaaaaaaaaaa", c: "pi_bbbbbbbbbbbbbbbb" });
    expect(intentCandidates(body)).toHaveLength(2);
    expect(intentCandidates("not json")).toEqual([]);
    expect(intentCandidates("")).toEqual([]);

    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, `pi_${String(i).padStart(16, "0")}`]));
    expect(intentCandidates(JSON.stringify(many)).length).toBeLessThanOrEqual(10);
  });
});

describe("refundIdFor", () => {
  it("is a stable UUID for one order and differs between orders", () => {
    const a = refundIdFor("order-one");
    expect(a).toBe(refundIdFor("order-one"));
    expect(a).not.toBe(refundIdFor("order-two"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
