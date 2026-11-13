import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { htmlToText, parseFrom, shouldIgnore, ticketBody, verifySvix } from "./inbound-mail";

const secret = "whsec_" + Buffer.from("test-secret").toString("base64");
const sign = (id: string, ts: number, body: string) => "v1," + createHmac("sha256", Buffer.from("test-secret")).update(`${id}.${ts}.${body}`).digest("base64");
const now = 1_800_000_000_000;
const ts = now / 1000;

describe("verifySvix", () => {
  it("accepts a correctly signed, fresh request, among several signatures", () => {
    const sig = `v1,bogus ${sign("m1", ts, "{}")}`;
    expect(verifySvix("{}", { id: "m1", timestamp: String(ts), signature: sig }, secret, now)).toBe(true);
  });
  it("refuses a wrong body, a wrong secret, missing headers and a stale timestamp", () => {
    const good = sign("m1", ts, "{}");
    expect(verifySvix("{ }", { id: "m1", timestamp: String(ts), signature: good }, secret, now)).toBe(false);
    expect(verifySvix("{}", { id: "m1", timestamp: String(ts), signature: good }, "whsec_" + Buffer.from("other").toString("base64"), now)).toBe(false);
    expect(verifySvix("{}", { id: null, timestamp: String(ts), signature: good }, secret, now)).toBe(false);
    expect(verifySvix("{}", { id: "m1", timestamp: String(ts - 3600), signature: sign("m1", ts - 3600, "{}") }, secret, now)).toBe(false);
  });
});

describe("parseFrom", () => {
  it("reads a display name and a bare address", () => {
    expect(parseFrom('"Sara Ali" <Sara@Example.com>')).toEqual({ name: "Sara Ali", email: "sara@example.com" });
    expect(parseFrom("sara@example.com")).toEqual({ name: "sara", email: "sara@example.com" });
    expect(parseFrom("not an address")).toBeNull();
  });
});

describe("shouldIgnore", () => {
  const base = { from: "Sara <sara@example.com>", to: ["support@dhirwa.ae"], subject: "Help with my plan" };
  it("lets a customer message through", () => {
    expect(shouldIgnore(base, "dhirwa.ae")).toBe(false);
  });
  it("drops our own address, bounces, auto replies, the contact form copy and dmarc reports", () => {
    expect(shouldIgnore({ ...base, from: "no-reply@dhirwa.ae" }, "dhirwa.ae")).toBe(true);
    expect(shouldIgnore({ ...base, from: "MAILER-DAEMON@mail.example.com" }, "dhirwa.ae")).toBe(true);
    expect(shouldIgnore({ ...base, subject: "Out of office until Monday" }, "dhirwa.ae")).toBe(true);
    expect(shouldIgnore({ ...base, subject: "[Support: billing] Sara" }, "dhirwa.ae")).toBe(true);
    expect(shouldIgnore({ ...base, to: ["dmarc@dhirwa.ae"] }, "dhirwa.ae")).toBe(true);
  });
});

describe("ticketBody and htmlToText", () => {
  it("puts the subject first and stays within a ticket's size", () => {
    expect(ticketBody("Hi", "Line one\r\n\r\n\r\n\r\nLine two")).toBe("Hi\n\nLine one\n\nLine two");
    expect(ticketBody("Hi", "x".repeat(5000)).length).toBe(2000);
  });
  it("turns html into readable text", () => {
    expect(htmlToText("<p>One &amp; two</p><style>p{}</style><p>Three</p>").trim()).toBe("One & two\nThree");
  });
});
