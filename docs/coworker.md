# Sentinel, the log-reading coworker

Sentinel reads only the site log (`SiteLog`), finds problems, and for code bugs opens a pull request. The owner granted it (2026-11-16) the authority to commit
and deploy, within the limits below. This file is the contract: `AGENTS.md` points here, and the limits are enforced in code (`src/lib/coworker/guard.ts`), not only in a prompt.

## How it works

- `.github/workflows/coworker.yml` calls `GET /api/cron/coworker` every 30 minutes (Vercel cron on this plan runs once a day at most). The route is guarded by `CRON_SECRET`.
- Each run is one small step (`src/lib/coworker/engine.ts`): move open pull requests forward, watch recent merges, take in new problems from the log, work on at most one open case.
- **Reads:** ERROR rows of the last 2 hours, grouped by fingerprint (ids and numbers blanked). Warnings are refusals, not bugs, and are not read. Its own `coworker.*` lines are skipped.
- **Decides** from `src/lib/log-catalog.ts` first: `ignore` (expected), `owner` (needs a person or an outside service: escalated, no code), `coworker` (a code fix may help). Unknown problems go to the model for triage.
- **Fixes** only after a problem was seen 3 times, and only in files it can name: the catalog files, the cron job route, or the route a `server.error` came from. The model returns exact `find`/`replace` edits (each `find` must match once), not whole files.
- **Ships** through a branch `coworker/*` and a pull request. CI (`check`, `e2e`) and the Vercel preview must be green. Both Vercel projects build `main`, so a merge is a deploy.
- **Watches** a merge for 30 minutes. If the same error comes back 3 times, it opens a revert pull request (the stored edits, inverted) and tells the owner.
- **Tells the owner** through an in-app notice and email (`notifyAdmins`) when it opens a fix, when a fix is ready, when it merged, and whenever something needs a person. Every case is on `/admin/ai`; every action is a `coworker.*` line in `/admin/logs`.

## Limits (code, `guard.ts`)

- May edit files under `src/` only.
- Never: `.env*`, `.github/**`, `vercel.json`, `package.json` and the lockfile, `prisma/**` (no migrations), `AGENTS.md`, `src/generated/**`, binary assets, or its own code (`src/lib/coworker/**`, `src/app/api/cron/coworker/**`).
- Never writes anything that looks like a key, a token, a private key, a long random string, or `ZIINA_TEST`. Stripe stays on test keys; live payment switches belong to the owner.
- At most 2 files and 80 changed lines per change; files over 600 lines are not edited.
- At most 1 merge per hour and 3 per day. No merge while the checks on `main` are red.
- Payments and auth code are allowed (the owner chose "full freedom except secrets"), but only behind green CI and the watch-and-revert above.

## Switches (owner)

- `/admin/ai`, "Sentinel": **Pause** stops everything. **Auto-merge** is off by default (shadow mode: it opens pull requests and never merges; you press merge on GitHub). Turn it on after you have read its first week of pull requests.
- `COWORKER_ENABLED=0` in Vercel stops it without a deploy. Removing `GITHUB_COWORKER_TOKEN` leaves it read-and-report only.
- To undo a merged change: revert the squash commit on `main` like any other.

## Setup (owner actions, never pasted into chat)

1. GitHub: a fine-grained personal access token for this repository only: Contents (read and write), Pull requests (read and write), Metadata and Checks (read), Commit statuses (read). Save it in Vercel as `GITHUB_COWORKER_TOKEN` (Production). If `main` has branch protection that blocks the token from merging, allow it, or leave auto-merge off.
2. GitHub repository secrets `APP_URL` (`https://dhirwa.ae`) and `CRON_SECRET` (same value as in Vercel) for the workflow.
3. Optional: `COWORKER_MODEL` to use a different Gemini model for triage and fixes than `AI_MODEL`; `COWORKER_REPO` if the repository moves.

## Privacy

The model sees scrubbed log facts (source, message, counts, times, route) and source code from this public repository. It never sees orders, users, messages or any database table other than `SiteLog`.
Gemini is already a listed processor (`docs/compliance/processors.md`). If Claude is used later, add Anthropic there first.
