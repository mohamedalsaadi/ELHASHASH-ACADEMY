import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ updateMany: vi.fn(async () => ({ count: 1 })) }));
vi.mock("@/lib/db", () => ({ db: { user: { updateMany: h.updateMany } } }));

import { unsubscribeUrl } from "@/lib/unsubscribe";
import { GET, POST } from "./route";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-unsubscribe-route";
});
beforeEach(() => h.updateMany.mockClear());

const link = () => unsubscribeUrl("https://dhirwa.ae", "user-1");

describe("unsubscribe route", () => {
  it("GET shows a confirmation form and writes nothing", async () => {
    const res = await GET(new Request(link()));
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<form method="post"');
    expect(html).toContain(new URL(link()).search.replace(/&/g, "&amp;"));
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("POST with a genuine link records the opt-out and shows the result", async () => {
    const res = await POST(new Request(link(), { method: "POST" }));
    expect(res.status).toBe(200);
    expect(h.updateMany).toHaveBeenCalledTimes(1);
    expect(await res.text()).not.toContain("<form");
  });

  it("a forged link is refused on both methods and writes nothing", async () => {
    const forged = link().replace(/s=.{4}/, "s=xxxx");
    expect((await GET(new Request(forged))).status).toBe(400);
    expect((await POST(new Request(forged, { method: "POST" }))).status).toBe(400);
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});
