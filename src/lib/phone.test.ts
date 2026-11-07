import { describe, expect, it } from "vitest";
import { joinPhone, phoneCandidates, splitPhone } from "./phone";
import { phoneSchema } from "./schemas/auth";

describe("joinPhone", () => {
  it("drops the trunk zero and the spaces", () => {
    expect(joinPhone("971", "050 123 4567")).toBe("+971501234567");
    expect(joinPhone("20", "01012345678")).toBe("+201012345678");
    expect(joinPhone("965", "51234567")).toBe("+96551234567");
  });
  it("stores nothing for an empty number, and the typed text under other", () => {
    expect(joinPhone("971", " ")).toBe("");
    expect(joinPhone("", " +447911123456 ")).toBe("+447911123456");
  });
  it("always passes the phone rule for a real mobile", () => {
    for (const [dial, n] of [["971", "0501234567"], ["966", "0501234567"], ["20", "01012345678"], ["965", "51234567"], ["974", "31234567"], ["973", "36123456"], ["968", "71234567"]]) {
      expect(phoneSchema.safeParse(joinPhone(dial, n)).success, `${dial} ${n}`).toBe(true);
    }
  });
});

describe("splitPhone", () => {
  it("round-trips a stored number into the picker", () => {
    expect(splitPhone("+971501234567")).toEqual({ dial: "971", national: "501234567" });
    expect(splitPhone("+201012345678")).toEqual({ dial: "20", national: "1012345678" });
  });
  it("keeps an unknown country or a local number whole under other, and starts empty on the first code", () => {
    expect(splitPhone("+447911123456")).toEqual({ dial: "", national: "+447911123456" });
    expect(splitPhone("0501234567")).toEqual({ dial: "", national: "0501234567" });
    expect(splitPhone("")).toEqual({ dial: "971", national: "" });
  });
});

describe("phoneCandidates", () => {
  it("offers every picker country for a local number, and only itself for an international one", () => {
    expect(phoneCandidates("0501234567")).toContain("+971501234567");
    expect(phoneCandidates("0501234567")).toContain("+966501234567");
    expect(phoneCandidates("+971501234567")).toEqual(["+971501234567"]);
  });
});
