<!-- Saved 2026-11-04 from the planning session. Status: not built beyond src/lib/ai.ts, AI grading suggestion,
AI parent report and AI ticket drafts. Bank-transfer items (O1) are void: bank transfer was deleted, Ziina only.
Order and approvals now follow docs/platform-gap-plan.md Phase 5. -->

# AI operations plan (solo owner, no staff) — phases 2–3 still open

## Context
- The owner wants to run A+ Academy with **no employees**. Only teachers on subcontract, plus the owner and AI running the whole backend.
- This plan lists every place AI can take over work that someone does by hand today: owner/admin, teacher, student, parent. It names the GitHub and hosted tools worth using.
- AI is already in two places, both on Gemini over plain `fetch`:
  - `src/lib/ai-grading.ts`: homework marking suggestion. The teacher clicks a button; the result is never shown to students.
  - `src/lib/bank-email.ts:170`: parses bank-transfer alert emails.
- **Rule for every item:** money moves, grades students see, and messages sent in the owner's name start as **drafts**. A human (the owner or the teacher) approves them in one click. Over time, low-risk items can switch to automatic.

## Foundation (do first, everything else builds on it)
1. **One AI helper, `src/lib/ai.ts`.** Pull the duplicated Gemini fetch out of `ai-grading.ts` and `bank-email.ts`.
   - Use the **Vercel AI SDK** (`ai` + `@ai-sdk/google`; MIT licence). It gives structured output via `generateObject` with zod, streaming and tool calls, and the provider can be swapped (Gemini, OpenAI, Anthropic).
   - Keep `GEMINI_API_KEY` and add `AI_MODEL` (cheap model by default, a stronger one for marking).
   - Add `AI_ENABLED` as a kill switch.
2. **AI log table** (additive migration `AiRun`): kind, subject id, model, tokens in/out, cost, status (DRAFT / APPROVED / REJECTED / AUTO), output JSON, approvedBy.
   - This is the owner's audit trail and the approval queue in one table.
   - Rate limits reuse `isLimited` from `src/lib/rate-limit.ts`.
3. **Owner approval queue `/admin/ai`.** Lists DRAFT runs with Approve / Edit / Reject. Its count shows on the admin home office tiles, next to pending transfers and open requests.
4. **Lesson text,** without which tutoring, question generation and summaries can only guess:
   - Wire up lesson PDFs: `pdfKey` upload in `admin/actions.ts` `updateLesson`, and a `lesson` kind in `src/app/api/files/[kind]/[id]/route.ts`.
   - Add a `Lesson.notes` text field (additive) for teacher notes or transcripts.
   - Transcripts are a phase-3 option. VdoCipher has no transcript API, so this needs the teacher's source video file and **ElevenLabs Scribe** (best Arabic WER) or Whisper.

## Owner / admin: replace the back office
| # | Job done by hand today | AI step | Entry point |
|---|---|---|---|
| O1 | Bank-transfer NEEDS_REVIEW queue: alerts already parsed by Gemini, but no_reference, amount_mismatch and low_confidence go to a queue **nobody is alerted to** | (a) Notify the owner when an alert lands in NEEDS_REVIEW. (b) For each queued alert, the AI **suggests the matching PENDING order** with a reason: name and amount near-match, the student's uploaded receipt read by vision (amount, date, reference, sender). The owner clicks "Approve suggestion". Auto-approve stays behind the existing `bankAutoApprove` + `BANK_AUTO_APPROVE` switches. | `src/lib/bank-email-server.ts` `receiveBankEmail`, `bank-email.ts` `matchBankEmail`, `admin/transfers/page.tsx` + `actions.ts` `matchBankEmailManually` |
| O2 | Support: the contact form is only emailed to `CONTACT_EMAIL` and **stored nowhere**; WhatsApp is off-platform | Store contact messages (additive `SupportTicket`) in `contact/actions.ts` `sendSupportMessage`. A **support agent** drafts or sends answers from an FAQ and policy knowledge base plus the user's own orders and enrolments (read-only tools). Unsure or money cases go to the owner as a draft. Later: **Chatwoot Cloud** inbox (WhatsApp + email + site widget) via webhook to `/api/ai/support`. | `src/app/[locale]/contact/actions.ts`, new route |
| O3 | Parent special requests | Triage (category, urgency) and a **draft reply** for staff to edit and send. | `src/lib/request-actions.ts` `createSpecialRequest` / `staffReply` |
| O4 | Daily check of what needs doing | **Daily briefing** email to the owner at 06:00 GST: revenue yesterday, pending transfers, open requests, ungraded homework older than 48 h, unanswered questions, failed payments, new signups. Numbers come from SQL; the AI only writes the summary. | extend `src/app/api/cron/reminders/route.ts`, or a new cron in `vercel.json` |
| O5 | Teacher payouts and finance | Monthly payout statement per teacher, drafted from `LedgerEntry` (30/70 on net). AI flags anomalies (refund spikes, a zero-revenue teacher). The owner approves; payment stays manual. | `src/lib/finance.ts`, `teacher/earnings` export |
| O6 | Moderation | Run student Q&A, reviews and request text through **OpenAI omni-moderation** (free) next to `maskContacts`. | `src/lib/contact-guard.ts` callers |
| O7 | Asking business questions | **Metabase** (self-hosted, free OSS licence) on a **read-only Neon role** with Metabot natural-language queries. Optional, phase 3. | outside the app |
| O8 | Marketing copy, SEO, social posts | Draft bilingual course descriptions and metadata from course data, then the owner approves. No invented numbers (DESIGN.md rule). | `admin/actions.ts` `updateCourse` |
| O9 | Teacher vetting | Summarise a teacher application from the contact form: subject, experience, red flags. | contact handler |
| O10 | Course quality: teachers publish with **no review gate** | When `published` flips on, the AI checks the course (empty units, missing videos, untranslated titles, prices out of range, policy issues). It notifies the owner with the check; serious issues hold publishing until the owner approves. | `admin/actions.ts` `updateCourse` |
| O11 | Refunds: requests arrive by email or request; Paymob refunds are done by hand | The support agent recognises refund requests and drafts a decision with the order history and the policy. The owner clicks `refundOrder`. | `admin/actions.ts` `refundOrder` |

Found while mapping, not AI: live-session reminders use windows of an hour or less, but the cron runs once a day (`vercel.json`), so most are missed. Fix by moving them to an hourly cron (Inngest or Vercel Cron) in phase 1.

## Teachers (subcontractors): less admin, more teaching
| # | AI step | Entry point |
|---|---|---|
| T1 | **Question generator**: from a lesson PDF or notes, make MCQ and SHORT items with explanations in Arabic + English. They land as drafts in the bank for the teacher to accept. | `teacher/bank/actions.ts` `createItem` |
| T2 | **Auto-mark homework on submit.** Today it runs only when the teacher clicks. Also add student-facing feedback (not just a rationale) and batch "mark all". The teacher still releases the grade. | `courses/[slug]/assignments/actions.ts` `submitAssignment`, `teacher/assignments/actions.ts` `gradeWithAi` |
| T3 | **WRITTEN exam marking**: let the bank create WRITTEN items with a model answer and rubric (additive fields), then add an AI suggestion (`aiMarks`, `aiRationale`) like homework. | `teacher/bank/ItemForm.tsx`, `teacher/exams/actions.ts` `gradeWritten` |
| T4 | **Draft answers to student questions**, grounded in lesson notes or PDF. The teacher edits and sends. | `teacher/questions/actions.ts` `answerQuestion` |
| T5 | Bilingual translation of titles, instructions and explanations (one button). | course builder, bank form |
| T6 | Class insight on analytics: weak concepts and students at risk, in plain words. | `teacher/analytics/page.tsx` |

## Students
| # | AI step | Entry point |
|---|---|---|
| S1 | **Lesson tutor**: an instant answer to a lesson question, grounded in lesson text, clearly labelled AI. The question still goes to the teacher, who can confirm or correct it. Paid subscribers only; it keeps the 5-a-day limit. | `courses/[slug]/lessons/[lessonId]/actions.ts` `askQuestion` |
| S2 | Explain a wrong practice answer when `explanation` is empty. | `practice/actions.ts` `submitPractice` |
| S3 | Lenient marking of SHORT answers by meaning (only when exact match fails). | `src/lib/practice.ts` `gradeItem` |
| S4 | Personal "next step" study plan from review schedule, weak concepts and exam dates. | `dashboard/page.tsx` |

## Parents
| # | AI step | Entry point |
|---|---|---|
| P1 | **AI-written weekly report** per child from lessons, practice, exams, homework feedback and weak concepts. It replaces the fixed sentence and keeps the existing weekly dedupe. | `src/app/api/cron/reminders/route.ts:85-126` |
| P2 | The support agent (O2) also answers parents: "how is my child doing", "how do I pay", from their linked children's data only. | O2 |

## GitHub / hosted stack (recommended, minimal)
- **Vercel AI SDK** (MIT): all model calls. Already fits Next.js.
- **pgvector on Neon** (built in): RAG over FAQ, policies and lesson notes. Embeddings: Gemini `text-embedding` (same key) or `bge-m3`.
- **Inngest** (Vercel Marketplace; free tier): durable jobs and retries for receipt matching, batch marking and weekly reports. Vercel Cron is enough at first.
- **Chatwoot Cloud** (MIT core): one inbox for WhatsApp, email and the site widget. Self-hosted "Captain AI" is enterprise-only, so connect our own agent instead.
- **Langfuse Cloud** (MIT; free hobby tier) for tracing and cost, and **promptfoo** (MIT) for evals on Arabic marking and the support answers.
- **OpenAI omni-moderation** (free).
- **Metabase OSS** (AGPL, self-host; fine for internal use) for BI.
- **Avoid as core:** n8n (fair-code), Typebot (FSL), marker (GPL, restricted weights), Unstract (AGPL as a service). Stripe MCP: never with the full secret key; Stripe stays on test.
- **Expected cost:** about $0–60/mo of tools on free tiers plus Chatwoot, and about $30–150/mo of model usage at current volume. Logged per run in `AiRun`.

## Phases
1. **Foundation + money-saving first:** `ai.ts`, `AiRun`, `/admin/ai`, the O4 daily briefing, O1 transfer alerts and suggested matches, O2 storing contact messages, T2 auto-mark on submit, P1 weekly parent report, the hourly reminder fix.
2. **Support and content:** lesson PDFs and notes, pgvector knowledge base, O2 support agent (site and email first, then WhatsApp via Chatwoot), O3 request drafts, T1 question generator, T4 draft answers, S1 tutor, O6 moderation.
3. **Depth:** T3 WRITTEN marking, S2–S4, T6 insights, O5 payout statements, O7 Metabase, transcripts, Langfuse/promptfoo evals.

## Guardrails
- Drafts first. Nothing AI-made moves money, sends in the owner's name, or shows a grade without approval, until the owner flips that kind to AUTO in `/admin/ai`.
- AI tools read through scoped queries (the user's own rows). No raw SQL from the model. The Metabase role is read-only.
- Never send phone numbers, emails or payment data to the model beyond what the task needs. Mask with `maskContacts`.
- `AI_ENABLED=false` turns everything off; the app keeps working by hand.
- Additive migrations only (until the end of 2026). Stripe stays on test. No new paid service without the owner's yes.

## Verification
- Vitest for `ai.ts` with a mocked provider: schema parsing, kill switch, rate limit, AiRun writes. Receipt matching gets fixture receipts (EN/AR); marking gets fixed submissions.
- promptfoo eval set of 20–30 Arabic and English cases for marking and support, run before changing models.
- Browser checks in `ar` and `en`: `/admin/ai` queue approve and reject; a homework submit creates a DRAFT; the weekly report preview.
- Run `npx tsc --noEmit`, `npm test` and `npm run build`. Stop the preview and clear `.next` around the build. Add a WORKLOG entry.
