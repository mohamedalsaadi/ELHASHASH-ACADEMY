import { afterEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();
vi.mock("@/lib/db", () => ({ db: { authAttempt: { count: (...a: unknown[]) => count(...a), create: vi.fn(), deleteMany: vi.fn() } } }));

import { isLimited, recordAttempt } from "./rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  count.mockReset();
});

describe("rate limits through Upstash", () => {
  it("counts attempts in Redis and never touches the database", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://r.example/");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchMock = vi.fn(async () => Response.json([{ result: 3 }]));
    vi.stubGlobal("fetch", fetchMock);
    expect(await isLimited("signup:1.1.1.1", 3, 60_000)).toBe(true);
    expect(await isLimited("signup:1.1.1.1", 4, 60_000)).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://r.example/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)[0][0]).toBe("ZCOUNT");
    expect(count).not.toHaveBeenCalled();
  });

  it("falls back to the database table when Redis fails or is not configured", async () => {
    count.mockResolvedValue(5);
    expect(await isLimited("k", 5, 1000)).toBe(true);
    vi.stubEnv("KV_REST_API_URL", "https://r.example");
    vi.stubEnv("KV_REST_API_TOKEN", "tok");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })));
    count.mockResolvedValue(1);
    expect(await isLimited("k", 5, 1000)).toBe(false);
    expect(count).toHaveBeenCalledTimes(2);
    await expect(recordAttempt("k")).resolves.toBeUndefined();
  });
});
