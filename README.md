<div align="center">

# 🤖 AI Kids Academy

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Auth.js](https://img.shields.io/badge/Auth.js-v5-000?logo=auth0&logoColor=white)](https://authjs.dev/)
[![Claude](https://img.shields.io/badge/Claude-Agent_SDK-D97757?logo=anthropic&logoColor=white)](https://docs.anthropic.com/)

**Where kids ages 4–16 don't just *use* AI — they *make* with it.** 🎨💻🎮

AI storytelling · coding · game design · phonics · escape rooms — a gamified learning playground plus live class booking for parents.

**[🚀 Live Site](https://ai4kids.tertiarycourses.com.sg/)** · [Report Bug](https://github.com/alfredang/ai4kids/issues) · [Request Feature](https://github.com/alfredang/ai4kids/issues)

**Also on mobile** — [![App Store](https://img.shields.io/badge/App_Store-AI4Kids-0D96F6?logo=apple&logoColor=white)](https://apps.apple.com/app/ai4kids/id6780267161) [![Google Play](https://img.shields.io/badge/Google_Play-AI4Kids-414141?logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=sg.com.tertiarycourses.ai4kids)

</div>

## Current family homepage

![AI Kids family homepage](screenshot.png)

## Screenshots

<div align="center">

| Homepage | Kids' Dashboard | Kid Login |
| :---: | :---: | :---: |
| <img src="docs/screenshots/homepage/homepage-1.png" width="260" /> | <img src="docs/screenshots/kids-dashboard.png" width="260" /> | <img src="docs/screenshots/login/kids-login.png" width="260" /> |
| **Story Builder** | **Talking Buddy** | **AI Art Studio** |
| <img src="docs/screenshots/story/story-builder.png" width="260" /> | <img src="docs/screenshots/talking-buddy.png" width="260" /> | <img src="docs/screenshots/art/art-studio.png" width="260" /> |
| **AI Phonics** | **AI Escape Rooms** | **Brain Arcade** |
| <img src="docs/screenshots/phonics.png" width="260" /> | <img src="docs/screenshots/escape-rooms.png" width="260" /> | <img src="docs/screenshots/card-games.png" width="260" /> |

</div>

## About

**AI Kids Academy** is a kids' AI education portal that combines a **gamified learning playground** with a **class-booking platform** for parents. Parents sign in, choose an owned child profile, and unlock the games together. Children play AI-powered activities and earn points and badges; parents browse programs, book classes online, and track their kids' progress; admins manage the whole catalogue from a back-office.

### Key Features

| Area | What it does |
|------|--------------|
| 🎭 **Three roles** | Parents sign in with email and password, then choose their child to unlock games. Google sign-in appears when configured. Staff use the separate admin sign-in. |
| 🧩 **AI activities** | Seven play-at-home games in the kid playground: **Story Builder** (branching, AI-illustrated tales + "write your own"), **AI Phonics** (listen-and-match), **Talking Buddy** (voice/text AI chat), **AI Art Studio** (paint an idea, then jigsaw it), **Code Puzzles**, **AI Escape Rooms** and **Brain Arcade** card games — each awarding points and badges. |
| 🏆 **Gamification** | Every activity awards a score; kids collect badges and climb an opt-in **leaderboard**. |
| 👨‍👩‍👧 **Parent dashboard** | Link multiple kids, see activities completed, total scores, badges, and recent activity per child. |
| 📅 **Online booking** | Parents book a class seat for a child in seconds. |
| 💳 **PayNow payments** | On confirmation, the system generates a dynamic **Singapore PayNow QR** (EMVCo SGQR) and emails it to the parent. |
| 🤖 **Agentic auto-close** | When a class hits its max students it **auto-closes** and an AI routine drafts the "class full" notifications for parents + admin. |
| 🛠️ **Admin back-office** | Manage programs, classes (open/close/edit/delete), bookings (confirm / mark-paid / cancel), and kid↔parent links. |
| 💬 **WhatsApp** | Floating click-to-chat button for instant parent enquiries. |
| 📱 **Mobile apps** | Companion **iOS** and **Android** apps are live; the site footer links to both store listings. |

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Framework** | Next.js 16 (App Router, Server Actions), React 19 |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 (one bright family theme, admin included), Framer Motion, Fraunces / Fredoka / Nunito fonts |
| **Database** | PostgreSQL 16 + Drizzle ORM |
| **Auth** | Auth.js v5 (Credentials + Google OAuth), JWT sessions, role-based access |
| **AI/LLM** | **Claude Agent SDK** for CMS/admin tools · **DeepSeek V4.1 Flash** for kids’ game text and chat · **NVIDIA FLUX** + **Cloudflare Flux** for kid-safe image generation |
| **Payments** | PayNow QR generation (EMVCo SGQR via `qrcode`) |
| **Email** | Gmail OAuth (transactional booking emails) |
| **Security** | bcrypt password hashing, AES-256-GCM encrypted credential store |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (clients)                        │
│   Public site  ·  Kid playground  ·  Parent dash  ·  Admin CMS   │
└───────────────┬───────────────────────────────┬──────────────────┘
                │  Next.js App Router (RSC + Server Actions)         
┌───────────────▼───────────────────────────────▼────────────────────┐
│  Auth.js v5 (role guard: learner / parent / admin)                 │
│  ┌──────────────┬────────────────┬───────────────┬───────────────┐ │
│  │  Booking +   │  AI activities │  Gamification │  Admin CRUD   │ │
│  │  PayNow QR   │  (Claude SDK)  │  scores/badge │  programs/... │ │
│  │  + agentic   │                │  leaderboard  │               │ │
│  │  auto-close  │                │               │               │ │
│  └──────┬───────┴───────┬────────┴──────┬────────┴─────┬─────────┘ │
└─────────┼───────────────┼───────────────┼──────────────┼───────────┘
          │               │               │              │
   ┌──────▼──────┐  ┌─────▼──────┐  ┌─────▼──────┐ ┌─────▼───────┐
   │ PostgreSQL  │  │ Claude     │  │  Gmail     │ │  PayNow QR  │
   │ (Drizzle)   │  │ Agent SDK  │  │  OAuth     │ │  (SGQR)     │
   └─────────────┘  └────────────┘  └────────────┘ └─────────────┘
```

## Project Structure

```
ai-kids/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Bright public homepage
│   │   ├── login/                   # Kid + Parent/Admin login tabs
│   │   ├── dashboard/               # Role dispatcher
│   │   ├── programs/                # Catalog + program detail
│   │   ├── holiday-workshops/[slug]/ # December workshop pages
│   │   ├── games/  free-trial/  contact/  blog/  # Public family pages
│   │   ├── not-found.tsx            # Friendly Pip 404
│   │   ├── book/[classId]/          # Booking flow
│   │   ├── parent/                  # Parent dashboard (kids, bookings, add child)
│   │   ├── learn/                   # Kid playground (activities, leaderboard)
│   │   │   ├── storytelling/        #   Story Builder + write-your-own
│   │   │   ├── phonics/             #   listen-and-match phonics games
│   │   │   ├── buddy/               #   Talking Buddy (AI voice/text chat)
│   │   │   ├── art/                 #   AI Art Studio → jigsaw
│   │   │   ├── code-puzzles/        #   robot path puzzles
│   │   │   ├── escape-room/         #   top-down escape rooms
│   │   │   ├── cards/               #   Brain Arcade card games
│   │   │   ├── stories/  gallery/   #   saved storybooks + artwork
│   │   │   └── leaderboard/         #   opt-in scores
│   │   ├── admin/                   # Back-office (programs/classes/bookings/people)
│   │   └── api/learn/               # Activity APIs (storytelling, phonics, buddy, art, cards, story-image, score)
│   ├── components/
│   │   ├── public/                  # SiteHeader, SiteFooter
│   │   ├── portal/                  # SignOutButton, shared portal UI
│   │   └── ui/                      # WhatsAppButton, ...
│   ├── db/schema.ts                 # Drizzle schema (programs, classes, bookings, …)
│   └── lib/
│       ├── auth.ts / portal-session.ts   # Auth + role guards
│       ├── paynow.ts                # EMVCo SGQR QR generator
│       ├── booking.ts               # Confirm → PayNow email → agentic auto-close
│       ├── ai.ts                    # Claude Agent SDK wrapper (with fallbacks)
│       ├── activities.ts            # Completions + badge awards
│       └── portal-queries.ts        # Dashboard + leaderboard queries
├── scripts/seed-portal.ts           # Seeds admin, demo parent + kids, programs…
├── drizzle/                         # SQL migrations
└── .env.example
```

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 16 (local or hosted, e.g. Neon/Supabase)

### Installation

```bash
# 1. Clone
git clone https://github.com/alfredang/ai4kids.git
cd ai4kids

# 2. Install (claude-agent-sdk needs legacy peer resolution)
npm install --legacy-peer-deps

# 3. Configure environment
cp .env.example .env
#   set DATABASE_URL, AUTH_SECRET (openssl rand -base64 32),
#   GOOGLE_CLIENT_ID/SECRET, ADMIN_EMAIL/PASSWORD, PAYNOW_UEN, WHATSAPP_NUMBER

# 4. Create the schema  (db:push is broken on local PG 18 — generate + migrate instead)
createdb ai_kids
npm run db:generate       # generate a migration from src/db/schema.ts
npm run db:migrate        # apply it

# 5. Seed demo data (admin, parent, kids, programs, classes, activities)
npm run seed:portal

# 6. Run
npm run dev               # http://localhost:3080
```

### Demo logins (from the seed)

| Role | Login |
|------|-------|
| Admin | `admin@…` / your `ADMIN_PASSWORD` — at `/admin/login` |
| Parent | `parent.demo@aikids.local` / `parent123` |
| Kids | `maya-star` / `play123` · `ethan-rocket` / `play123` |

### Enabling the AI + email integrations

The app works fully offline with graceful fallbacks. To go live, add credentials in **Admin → Settings → Credentials** (encrypted store):

- **`anthropic_auth_token`** (an `sk-ant-oat-…` subscription token) — powers AI stories, phonics word-sets and the agentic class-close. Without it, deterministic fallback content is used.
- **Gmail OAuth** (`gmail_user`, `gmail_client_id`, `gmail_client_secret`, `gmail_refresh_token`) — sends the PayNow booking emails. Without it, the QR still renders in the parent dashboard.

## Deployment

Built `output: "standalone"` — deploy as a Docker container (Coolify / Railway / Fly.io) or to **Vercel + Neon/Supabase Postgres**.

```bash
docker build -t ai-kids .
docker run -p 3080:3080 --env-file .env ai-kids
```

Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, and Google OAuth env vars in your hosting platform.

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing`
3. Commit your changes: `git commit -m "feat: add amazing"`
4. Push and open a Pull Request

## Developed By

**[Tertiary Infotech Academy Pte. Ltd.](https://www.tertiarycourses.com.sg/)**

## Acknowledgements

- Backend foundation derived from the in-house **ai-cms** platform
- Built with [Next.js](https://nextjs.org/), [Drizzle ORM](https://orm.drizzle.team/), [Auth.js](https://authjs.dev/) and the [Anthropic Claude Agent SDK](https://docs.anthropic.com/)

---

<div align="center">

⭐ If this project sparked some curiosity, give it a star!

</div>

### December family workshops and parent-unlocked games

- Photo-first Singapore family homepage, three-scene Tetris photo banner and original sunny / plush characters.
- **Pip**, the floating helper: winks, hops, waves and wears a smiling chat bubble on the cap. Pop-ups rotate a December alert and each workshop; tapping one opens Pip's chat on that workshop, which hands off to WhatsApp. Visitors can dismiss them for the session.
- Friendly 404 page, with redirects for parent paths and retired URLs in `next.config.ts`. Family courses are not funded, so the site carries no SSG, SWDA or WSQ content.
- December AI story writing, math, science and creative-content workshop enquiries; dates and fees are confirmed by the team.
- Free printable family activity pack and adult-guided tools.
- `Explore games` opens `/parent/play`. Parent authentication and live child ownership are required for every `/learn` page and API; direct child logins do not unlock games.
- AI text uses **DeepSeek V4.1 Flash**, official model ID `deepseek-flash`. Set `deepseek_api_key` in Admin → Settings → Credentials (encrypted at rest); `DEEPSEEK_API_KEY` is the environment fallback. Art and voice retain separate providers. No silent Claude/Gemini text fallback.
- Marketing canonicals and sitemap target `https://ai4kids.tertiarycourses.com.sg`; private family/game routes are excluded.
- Production: push `main` to trigger the existing Coolify Docker deployment. This server-rendered app is not a GitHub Pages deployment.

Native clients use `GET /api/parent/play` to list the authenticated parent’s child profiles and `POST /api/parent/play` with `{ childId }` to select one. The server checks the live parent role and ownership before setting the HTTP-only play-profile cookie. Every game request rechecks ownership. Provider API keys stay in the server credential vault.
