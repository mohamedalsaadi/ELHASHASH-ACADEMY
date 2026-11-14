import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  isStaff: vi.fn(),
  isLimited: vi.fn(),
  recordAttempt: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/catalog", () => ({ grantsFor: vi.fn() }));
vi.mock("@/lib/staff", () => ({ isCourseStaffDb: h.isStaff }));
vi.mock("@/lib/rate-limit", () => ({ isLimited: h.isLimited, recordAttempt: h.recordAttempt }));
// The real library mints the token; here it only runs the route's own check.
vi.mock("@vercel/blob/client", () => ({
  handleUpload: async ({ body, onBeforeGenerateToken }: { body: { pathname: string; clientPayload: string }; onBeforeGenerateToken: (p: string, c: string) => Promise<unknown> }) =>
    onBeforeGenerateToken(body.pathname, body.clientPayload),
}));

import { avatarPrefix, lessonPagesPrefix } from "@/lib/blob";
import { POST } from "./route";

const send = (pathname: string, payload: object) =>
  POST(new Request("https://dhirwa.ae/api/blob/upload", { method: "POST", body: JSON.stringify({ pathname, clientPayload: JSON.stringify(payload) }) }));

beforeEach(() => {
  vi.resetAllMocks();
  h.auth.mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
  h.isStaff.mockResolvedValue(true);
  // Behaves like the real limiter: counts what recordAttempt wrote.
  let count = 0;
  h.recordAttempt.mockImplementation(async () => void (count += 1));
  h.isLimited.mockImplementation(async (_key: string, max: number) => count >= max);
});

describe("/api/blob/upload daily cap", () => {
  it("records each capped upload and refuses the 51st", async () => {
    const path = `${avatarPrefix("u1")}a.png`;
    for (let i = 0; i < 50; i++) expect((await send(path, { purpose: "avatar", userId: "u1" })).status).toBe(200);
    expect(h.recordAttempt).toHaveBeenCalledTimes(50);
    expect(h.recordAttempt).toHaveBeenCalledWith("upload:u1");

    const res = await send(path, { purpose: "avatar", userId: "u1" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Too many uploads today" });
    expect(h.recordAttempt).toHaveBeenCalledTimes(50);
  });

  it("does not count a request that fails a later check", async () => {
    const res = await send("elsewhere/a.png", { purpose: "avatar", userId: "u1" });
    expect(res.status).toBe(400);
    expect(h.recordAttempt).not.toHaveBeenCalled();
  });

  it("leaves lesson pages out of the cap", async () => {
    const res = await send(`${lessonPagesPrefix("c1")}1.jpg`, { purpose: "lessonpage", courseId: "c1" });
    expect(res.status).toBe(200);
    expect(h.isLimited).not.toHaveBeenCalled();
    expect(h.recordAttempt).not.toHaveBeenCalled();
  });
});
