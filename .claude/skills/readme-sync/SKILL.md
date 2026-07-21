---
name: readme-sync
description: Keeps the root README.md accurate and on-voice as the app changes. The README is a product showcase — centered header, shields.io badges, a Key Features table, a Tech Stack table, an ASCII architecture diagram, a project-structure tree, Getting Started, demo logins, and deployment notes — and every section silently drifts from the code. Use after adding/renaming/removing a /learn activity or game, changing a dependency version, altering the AI provider wiring, changing npm scripts / setup steps / env vars, or when asked to "update the README" — to reconcile each section against its real source of truth and preserve the file's voice.
---

# README Sync — AI Kids (web)

There is **one README** in this repo: **[README.md](../../../README.md)** (root) — a **product showcase**: `<div align="center">` header, shields.io badges, curated Key-Features / Tech-Stack tables, an ASCII architecture diagram, a project-structure tree, Getting Started, demo logins, deployment. Marketing-lite, but **every claim must be true**.

## Golden rule

**Read the source before you touch a number, name, version, flag, or path.** Every claim has a file that owns it — open that file; don't trust the README's current value (it may be the stale one). Don't `git add`/commit unless asked — that's [git-push](../../commands/git-push.md)'s job.

## Section → source of truth

| Section | Verify against |
| --- | --- |
| Top **badges** + **Tech Stack** table (Next.js, React, TypeScript, Tailwind, Drizzle, PostgreSQL, Auth.js, Claude) | [package.json](../../../package.json) `dependencies`/`devDependencies`. Badge ↔ table ↔ prose must state the **same** major versions (e.g. `next ^16`, `react ^19`, `tailwindcss ^4`, `next-auth 5.x`, `drizzle-orm 0.36.x`). |
| **Key Features** table — which /learn activities are live vs "scaffolded" | The real games under [src/app/learn/](../../../src/app/learn/) (`page.tsx` per folder: storytelling, phonics, buddy, art, code-puzzles, escape-room, cards, plus stories/gallery/leaderboard) and `CATEGORIES` in [src/lib/portal-content.ts](../../../src/lib/portal-content.ts). If a folder has a playable `page.tsx`, it is **not** "scaffolded". |
| **Tech Stack** "AI/LLM" row | The AI wiring is split, per [CLAUDE.md](../../../CLAUDE.md) (the `ai-kids-games-gemini-ok` policy): **Claude Agent SDK** ([src/lib/ai.ts](../../../src/lib/ai.ts)) powers the CMS chatbot + admin AI Assist + agentic class-close; the **/learn kids games** use **Google Gemini** ([src/lib/gemini-chat.ts](../../../src/lib/gemini-chat.ts)) for text/TTS and **NVIDIA FLUX / Cloudflare Flux** ([src/lib/kid-image.ts](../../../src/lib/kid-image.ts)) for images. Both `@anthropic-ai/claude-agent-sdk` and `@google/generative-ai` are in package.json — don't claim Claude is the only LLM path. |
| Image-provider order (if mentioned) | [src/lib/kid-image.ts](../../../src/lib/kid-image.ts) `generateKidImage()` — currently **Cloudflare Flux-1-schnell first (fast), NVIDIA FLUX.1-dev fallback**. Keep this straight (it has flipped) and matching the Android README. |
| **Architecture** ASCII diagram | Real wiring: Auth.js role guard, booking + PayNow ([src/lib/paynow.ts](../../../src/lib/paynow.ts), [src/lib/booking.ts](../../../src/lib/booking.ts)), activities/scoring ([src/lib/activities.ts](../../../src/lib/activities.ts)), admin CRUD. Conceptual but true. |
| **Project Structure** tree | The real tree under [src/](../../../src/); keep the one-line purpose comments. The `learn/` node must list the activities that actually exist, not just storytelling + phonics. |
| **Getting Started** (install, env, schema, seed, run) | [package.json](../../../package.json) `scripts` + [CLAUDE.md](../../../CLAUDE.md). Non-obvious truths to preserve: port is **3080** (not 3000); install needs `--legacy-peer-deps`; **`db:push` is broken on local PG 18** — prefer `db:generate` + `db:migrate`; seeds are `seed:portal` / `seed:admin`; there is **no test suite** — `npm run build` + the `check:*` scripts are the gates. |
| **Demo logins** | [scripts/seed-portal.ts](../../../scripts/seed-portal.ts) — the actual seeded users/passwords. |
| **Deployment** | [Dockerfile](../../../Dockerfile) + [CLAUDE.md](../../../CLAUDE.md) → Deployment: production runs on **Coolify** (Next `standalone`); **pushing to `main` auto-redeploys prod**. If the README also lists Vercel/other hosts as an option, keep it clearly secondary to the real Coolify pipeline. |
| **Screenshots** | Files that actually exist — `screenshot.png` at the repo root and/or `docs/screenshots/`. **Never reference an image that isn't there.** |

## Voice & format (preserve, don't "improve")

- Keep the `<div align="center">` header + badge row + shields.io style — change a badge's **value**, not its style.
- One emoji per feature/activity, matching the game's own emoji.
- **British/Singapore spelling** (colour, personalise).
- **Brand name:** use the short name **Tertiary Infotech Academy** in prose/marketing copy; the legal name **Tertiary Infotech Academy Pte. Ltd.** is fine only in the "Developed By" / legal line (per [CLAUDE.md](../../../CLAUDE.md) → Company).
- Honest — no aspirational features. If it's not shipped in the code, it's not in the README as done.

## Known-stale spots to check first (as of writing)

Verify against source and fix if still wrong:

- **Key Features "AI activities" row** — claims only *AI Storytelling + AI Phonics* are "fully playable" and the rest "scaffolded". Stale: Talking Buddy, Art Studio, Story Builder, Code Puzzles, Escape Rooms and the card games are live under [src/app/learn/](../../../src/app/learn/). Reconcile against the real `page.tsx` folders.
- **Tech Stack "AI/LLM" row** — says "Anthropic Claude Agent SDK (stories, phonics word-sets, agentic class-close)". Stale: the kids games now run on **Gemini + NVIDIA/Cloudflare**; Claude is the CMS chatbot + admin AI Assist + agentic class-close. Split the credit correctly.
- **Project Structure `learn/` node** — lists only `storytelling/` and `phonics/`; add the activities that now exist.
- **Screenshots** — a single root `screenshot.png`; a captioned gallery under `docs/screenshots/` may be planned. Only reference images that are present.

## The Android downstream caveat

Per [CLAUDE.md](../../../CLAUDE.md), the **`ai4kids_android`** app mirrors this repo's `/learn` behaviour and has its **own** `readme-sync` skill. When a change here alters something the Android README also states (e.g. the image-provider order), the two READMEs should agree — but sync them in their own repos; don't edit Android files from here unless asked.

## Workflow

1. Identify which README section(s) the change touches.
2. For each, **open the source-of-truth file** and diff it against the README text.
3. Edit only the drifted lines; preserve surrounding format, emoji, and voice.
4. Keep the README numerically consistent (a version appears in badge + table + prose — update all).
5. Summarise what changed and which source proved the old value stale. Leave committing to [git-push](../../commands/git-push.md).
