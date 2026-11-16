import { describe, expect, it } from "vitest";
import { KNOWN_PROBLEMS, matchKnown } from "./log-catalog";

describe("matchKnown", () => {
  it("recognises the VdoCipher trial limit as an owner problem", () => {
    const k = matchKnown("vdocipher.slot", 'VdoCipher upload slot failed: 403 {"message":"You have reached the trial limit of 4 videos."}');
    expect(k?.code).toBe("VDO_TRIAL_LIMIT");
    expect(k?.who).toBe("owner");
  });
  it("treats a staff Google refusal as expected", () => {
    expect(matchKnown("auth.refused", "Google sign-in refused: staff accounts use a password")?.who).toBe("ignore");
  });
  it("flags an orphaned payment as high severity", () => {
    expect(matchKnown("payment.orphan", "gateway payment created but its id was not saved on the order")?.severity).toBe("high");
  });
  it("sends a failed cron to the coworker", () => {
    expect(matchKnown("cron.briefing", "failed: Error: boom")?.who).toBe("coworker");
  });
  it("returns null for a line nobody described", () => {
    expect(matchKnown("something.new", "unheard of")).toBeNull();
  });
  it("has unique codes, both languages, and files only where a code fix can help", () => {
    const codes = KNOWN_PROBLEMS.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const p of KNOWN_PROBLEMS) {
      expect(p.titleEn && p.titleAr && p.fixEn && p.fixAr).toBeTruthy();
      // server.error finds its file from the route stored on each row, so it needs none here.
      if (p.who === "coworker" && p.code !== "SERVER_ERROR") expect(p.files.length).toBeGreaterThan(0);
    }
  });
});
