import { describe, expect, it } from "vitest";
import { mayDraft } from "./support";

describe("mayDraft", () => {
  it("keeps privacy requests away from the model", () => {
    expect(mayDraft("privacy")).toBe(false);
  });

  it("still drafts ordinary support topics", () => {
    for (const topic of ["general", "billing", "technical"]) expect(mayDraft(topic)).toBe(true);
  });
});
