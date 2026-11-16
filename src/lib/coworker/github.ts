// A small GitHub REST client for the coworker: branches, file edits, pull requests, checks and merge. Plain fetch, no SDK.
// The token is GITHUB_COWORKER_TOKEN (fine-grained: contents and pull requests write, checks and metadata read), set in Vercel by the owner.

export type Checks = "pending" | "success" | "failure";
export type PrState = { state: "open" | "closed" | "merged"; headSha: string; checks: Checks; hasChecks: boolean };

export interface Gh {
  mainSha(): Promise<string>;
  getFile(path: string, ref: string): Promise<{ content: string; sha: string } | null>;
  createBranch(name: string, fromSha: string): Promise<void>;
  putFile(branch: string, path: string, content: string, blobSha: string, message: string): Promise<string>;
  openPr(branch: string, title: string, body: string): Promise<number>;
  prState(n: number): Promise<PrState>;
  mergePr(n: number, headSha: string, title: string): Promise<string | null>;
  closePr(n: number, comment: string): Promise<void>;
  deleteBranch(name: string): Promise<void>;
  checksFor(sha: string): Promise<{ checks: Checks; hasChecks: boolean }>;
}

export const repoName = () => process.env.COWORKER_REPO || "mohamedalsaadi/ELHASHASH-ACADEMY";
export const githubConfigured = () => Boolean(process.env.GITHUB_COWORKER_TOKEN);
export const prUrl = (n: number) => `https://github.com/${repoName()}/pull/${n}`;

type CheckRun = { name: string; status: string; conclusion: string | null };

/** Reduces check runs and commit statuses to one answer. Success needs at least one check and every one passing. */
export function summariseChecks(runs: CheckRun[], statuses: { state: string }[]): { checks: Checks; hasChecks: boolean } {
  const bad = new Set(["failure", "cancelled", "timed_out", "action_required", "startup_failure"]);
  const ok = new Set(["success", "neutral", "skipped"]);
  const all = runs.length + statuses.length;
  if (runs.some((r) => r.status === "completed" && r.conclusion && bad.has(r.conclusion)) || statuses.some((s) => s.state === "failure" || s.state === "error")) return { checks: "failure", hasChecks: all > 0 };
  if (all === 0 || runs.some((r) => r.status !== "completed") || statuses.some((s) => s.state === "pending")) return { checks: "pending", hasChecks: all > 0 };
  if (runs.every((r) => r.conclusion && ok.has(r.conclusion))) return { checks: "success", hasChecks: true };
  return { checks: "pending", hasChecks: true };
}

export function githubClient(fetcher: typeof fetch = fetch): Gh {
  const base = `https://api.github.com/repos/${repoName()}`;
  async function api<T>(path: string, init?: RequestInit & { allow404?: boolean }): Promise<T | null> {
    const res = await fetcher(`${base}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${process.env.GITHUB_COWORKER_TOKEN}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 404 && init?.allow404) return null;
    if (!res.ok) throw new Error(`github ${init?.method ?? "GET"} ${path.split("?")[0]} ${res.status}: ${(await res.text()).replace(/\s+/g, " ").slice(0, 160)}`);
    return res.status === 204 ? (null as T) : ((await res.json()) as T);
  }
  const need = async <T>(path: string, init?: RequestInit) => (await api<T>(path, init)) as T;

  const gh: Gh = {
    async mainSha() {
      return (await need<{ object: { sha: string } }>("/git/ref/heads/main")).object.sha;
    },
    async getFile(path, ref) {
      const f = await api<{ content: string; sha: string; type: string }>(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, { allow404: true });
      if (!f || f.type !== "file") return null;
      return { content: Buffer.from(f.content, "base64").toString("utf8"), sha: f.sha };
    },
    async createBranch(name, fromSha) {
      await need("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${name}`, sha: fromSha }) });
    },
    async putFile(branch, path, content, blobSha, message) {
      const r = await need<{ commit: { sha: string } }>(`/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        body: JSON.stringify({ message, content: Buffer.from(content, "utf8").toString("base64"), sha: blobSha, branch }),
      });
      return r.commit.sha;
    },
    async openPr(branch, title, body) {
      return (await need<{ number: number }>("/pulls", { method: "POST", body: JSON.stringify({ title, head: branch, base: "main", body }) })).number;
    },
    async checksFor(sha) {
      const [runs, status] = await Promise.all([
        need<{ check_runs: CheckRun[] }>(`/commits/${sha}/check-runs?per_page=100`),
        need<{ statuses: { state: string }[] }>(`/commits/${sha}/status`),
      ]);
      return summariseChecks(runs.check_runs, status.statuses);
    },
    async prState(n) {
      const pr = await need<{ state: string; merged: boolean; head: { sha: string } }>(`/pulls/${n}`);
      const c = pr.merged ? { checks: "success" as Checks, hasChecks: true } : await gh.checksFor(pr.head.sha);
      return { state: pr.merged ? "merged" : pr.state === "open" ? "open" : "closed", headSha: pr.head.sha, ...c };
    },
    async mergePr(n, headSha, title) {
      const r = await api<{ sha?: string; merged?: boolean }>(`/pulls/${n}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "squash", sha: headSha, commit_title: title }) });
      return r?.merged ? (r.sha ?? null) : null;
    },
    async closePr(n, comment) {
      await need(`/issues/${n}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) });
      await need(`/pulls/${n}`, { method: "PATCH", body: JSON.stringify({ state: "closed" }) });
    },
    async deleteBranch(name) {
      await api(`/git/refs/heads/${name}`, { method: "DELETE", allow404: true });
    },
  };
  return gh;
}
