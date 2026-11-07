---
name: tia-frontend-design-site
description: Project-locked frontend design skill for the AI Kids portal. Enforces the bright, playful family look across the public site and the /learn games — a sky-blue and lavender scrapbook in Fraunces + Nunito for parent pages, Fredoka + Nunito on cream for play screens, rounded cards, original icons, Pip the mascot and lots of gentle motion. No funding or SSG/SWDA content. Use whenever building or refining any public-facing or learner UI in this repo. The /admin back-office and sign-in pages use the same light theme. Load with the user-level tia-frontend-design skill.
---

# AI Kids — Bright & Friendly Aesthetic

**Load the user-level `tia-frontend-design` skill as well.** It owns the group's rules: no dead space or gaps, no chips, no template layouts, an animated hero, generated images and a lighter theme by default. This file records how they apply on this site and wins on theme and look.

**No funding content, ever.** Kids' courses are not funded, so this site has no SSG, SWDA, SkillsFuture, WSQ, IBF, TPQA or ATO pages, copy, keywords, admin screens or lead sources. The repo was cloned from the corporate CMS, so check inherited code and skills before trusting them.

This skill is locked to ONE design direction for everything a child or parent sees: the public marketing pages and the `/learn` games, activities, and escape rooms. Think **warm, rounded, chunky, joyful** — a kid should feel like they're playing, not using software. Do not invent new palettes, fonts, or moods.

>  The `/admin` back-office uses this same light theme. Nothing from `ai-cms`'s dark sci-fi design belongs in this app.

## Where the group rules apply

| Screens | Spacing and chips |
|---|---|
| **Parent-facing pages:** the landing page, `/programs`, `/free-trial`, `/blog`, `/parent/*`, legal pages | Follow `tia-frontend-design` fully: compact sections, no dead space, no chips, no template layouts |
| **Play screens:** `/learn` games, activities, escape rooms and other screens children play on | The one exception: big, rounded and roomy, with large pill buttons |

Where this file says "big" or "breathable", it means play screens.

## Two visual layers

Parent pages have moved on from the original cream theme. Copy from these before the recipes further down.

| | Parent pages | Play screens |
|---|---|---|
| **Wrapper** | `.kids-marketing` (home, games, 404) or `.kids-workshop-page` (catalogue, workshops, free trial) | Tailwind recipes below |
| **Tokens** | `--kid-*` in [kids-marketing.css](src/app/kids-marketing.css): sky `#edf7ff`, ink `#343c79`, berry `#b53c72`, yellow `#ffda70`, line `#cfcae3` | `@theme` tokens below |
| **Display font** | Fraunces (`--font-story-import`) with soft, wonky axes | Fredoka (`font-fun`) |
| **Body font** | Nunito | Nunito |
| **Icons** | [KidsIcon.tsx](src/components/public/KidsIcon.tsx), or `PlayfulText` to turn data emoji into icons | Emoji in tinted tiles |

`.kids-public-shell` ([PublicTheme.tsx](src/components/public/PublicTheme.tsx)) restyles older Tailwind pages towards this look, and `.kids-legacy-page` does the same for `/blog`, `/privacy` and `/terms`. Do not rely on them for new pages. Use a real wrapper.

`PlayfulText` draws a stand-in character for any emoji it has no icon for, so add unmapped ones to `ICONS` in [PlaySymbol.tsx](src/components/public/PlaySymbol.tsx) or pass a `KidsIcon` directly.

## Theme, hero and images

- **Theme:** bright and light everywhere, including `/admin`, because the audience is children and parents.
- **Hero:** [FamilyBanner.tsx](src/components/public/FamilyBanner.tsx) is the animated homepage hero, with [PipMascot.tsx](src/components/public/PipMascot.tsx) and `ToyboxArt` in [WorkshopArt.tsx](src/components/public/WorkshopArt.tsx). It pauses for reduced motion and the site's motion toggle. Keep it animated; do not replace it with a static image.
- **Images:** generate new images; do not use stock or library images. Match the warm, sunny Singapore family scenes in `public/images/` (`family-ai-banner`, `story-workshop-banner`, `maths-workshop-banner`) and the plush characters in `public/icons/` (`story`, `art`, `maths`, `science` friends), and save them as WebP. Prompts are recorded in `docs/playful-december-redesign.md`. Generated people are illustrations, never real families, students or testimonials: say "Illustration of…" in the `alt`. Art and science workshops still borrow other scenes, so give them their own when a generator is available.
- **Footer:** [SiteFooter.tsx](src/components/public/SiteFooter.tsx).
- **404 and redirects:** [not-found.tsx](src/app/not-found.tsx) and `redirects()` in [next.config.ts](next.config.ts). Retired corporate URLs redirect home.

## Pip, the chat widget

[WhatsAppButton.tsx](src/components/ui/WhatsAppButton.tsx), [PipMascot.tsx](src/components/public/PipMascot.tsx), with styles at the end of [kids-marketing.css](src/app/kids-marketing.css).

- **Look:** 112px on desktop and 92px on mobile, with a sunny halo. Pip blinks, winks, hops, waves and wears a smiling chat bubble on the cap, the `chat` icon in `KidsIcon`. Never use a phone handset or the stock WhatsApp logo. Outside the widget, Pip keeps the winking portrait with the star cap.
- **Pop-ups:** the December alert first, then each workshop in `HOLIDAY_WORKSHOPS`. The first comes after 4.5 seconds, then one every 21 seconds, up to 10 per browser session. Dismissing mutes them for the session.
- **Site exception:** tapping a pop-up opens Pip's panel on that workshop instead of going straight to WhatsApp, because the panel answers first and then hands off with the question pre-filled.
- **Label:** the bubble's label is plain coloured text, not a pill.

## Motion recipes

Motion is part of this site's personality, so every parent page gets all three layers from `tia-frontend-design`.

- **Entrance:** `kids-rise`, as a class or keyframe, with a stagger through `animation-delay`.
- **Hover:** lift plus a slight tilt on cards; `kids-tile-wiggle` on icons and tiles; a slow zoom on images.
- **Idle:** `kid-bob` for characters and stickers; the `pip-*` loops for the widget.
- **Off switches:** the footer's "Pause the wiggles" control sets `.kids-motion-paused`. Add new loops to it and to the `prefers-reduced-motion` rule.

## Layout recipes

- **Uneven grids:** `.kids-catalogue-grid` and `.kids-games-grid` use 12 columns with spans of 5-4-3, 3-4-5. The catalogue grid also has the `:last-child` rules for variable counts.
- **Heading with something beside it:** `.kids-catalogue-top` and `.kids-games-hero`.
- **Filling shorter columns:** `.kids-workshop-scene` and `.kids-trial-photo` stretch a generated scene to level the columns.
- **Labels and filters:** `.kids-plain-label` and `.kids-text-filter`, never pills.

## Known violations

Do not copy these. Fix them when you touch the file.

- **Old Tailwind recipes on parent pages:** `app/programs/[slug]/page.tsx`, `app/book/`, `app/parent/*` and `FreeTrialForm` still use the cream-era classes, restyled by `.kids-public-shell`.
- **Old class names in `/admin` and `/blog`:** `text-white`, `bg-white/N` and similar still appear in markup, restyled by `admin-theme.css` and `.kids-legacy-page`. Replace them when you touch the file.
- **Repo skills:** `seo-audit`, `lead-magnets` and `blog-post` were written for the corporate site. Use their method, not their audience or keywords.

## Design tokens (LOCK these)

Defined in [src/app/globals.css](src/app/globals.css) under `@theme`. Reference these as Tailwind colors (`bg-coral`, `text-sky-600`, `ring-mint/30`, `bg-cream`) and never introduce off-palette colors.

```
--color-cream:     #fff8ee   /* default page background (html/body) */
--color-coral:     #ff6b6b   /* PRIMARY action / brand pop */
--color-sky:       #38bdf8   /* secondary / info / links */
--color-mint:      #34d399   /* success / correct / "go" */
--color-grape:     #a855f7   /* playful purple accent */
--color-bubble:    #ec4899   /* pink accent */
--color-sunny:     #ffd23f   /* yellow highlight / stars */
--color-tangerine: #fb923c   /* orange accent */
```

Build cards on **white** (`bg-white`) over the cream page. Use `slate-800/900` for headings and `slate-500/600` for body text on white. Accents are used as soft tints (`bg-grape/15 text-grape`) and rings (`ring-grape/30`), not flat fills, except on buttons.

## Typography

- **Display / headings / buttons**: `font-fun` (Fredoka) — `font-700`, friendly and rounded. This is the personality font; use it for titles, button labels, scores, game names.
- **Body / paragraphs / supporting copy**: `font-round` (Nunito) — `font-500/600`.
- **Mono** (`font-mono`, JetBrains Mono): ONLY for room codes / tokens (e.g. a join code like `LION42`). Never for body.
- Never use Exo 2, Inter, Arial or system sans.

## Required visual language

Kid/public UI should feel rounded, soft, and tactile. Reach for these:

1. **Big rounded corners** — `rounded-3xl` or `rounded-[2rem]` for cards/panels, `rounded-full` for buttons, pills, and avatars/badges.
2. **Soft shadows + hairline rings** — `shadow-sm` (resting) / `shadow-lg` (raised), with `ring-1 ring-slate-100` or `ring-amber-100`. No hard borders.
3. **Emoji as icons** — emoji are ENCOURAGED here (🧠 🃏 🔢 🎲 🦦 🚀 ⭐ 🎉). Put a big emoji in a tinted rounded tile (`flex h-14 w-14 items-center justify-center rounded-2xl bg-grape/15 text-3xl`).
4. **Bright gradient banners** — soft pastel gradients for headers/heroes, e.g. `bg-gradient-to-r from-bubble/30 to-sky/30` or `from-sky/20 via-cream to-coral/20`. Keep them light, never neon.
5. **Per-feature accent colour** — each game/section picks one accent (coral / sky / mint / grape / bubble) and uses it consistently for its tile, ring, and highlights.

## Component patterns (Tailwind recipes — there are no kid-specific CSS utility classes)

- **Headings**: `font-fun text-2xl font-700 text-slate-900` (page titles bigger). Taglines: `font-round text-slate-500`.
- **Cards**: `rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100`. Hover lift: add `transition hover:scale-[1.02]` or `card-hover`-style `hover:-translate-y-1` (write it inline; the `.card-hover` class is dark-theme).
- **Primary button**: `rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow transition hover:scale-105`. This coral pill is THE call to action.
- **Secondary button**: `rounded-full bg-slate-100 px-5 py-2.5 font-fun font-700 text-slate-600 hover:bg-slate-200`. Or a soft-tinted accent (`bg-sky px-4 py-2 text-white`).
- **Selectable tiles / answer cards**: white with `ring-1 ring-slate-200`; selected = `scale-[1.05] bg-<accent> text-white ring-2 ring-<accent>/60`.
- **Forms / inputs**: `rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral`. Big, rounded, friendly — never tight admin inputs.
- **Success / error feedback**: success = `bg-mint/20 text-emerald-700 ring-1 ring-mint/40`; gentle error/nudge = `bg-coral/10 text-coral ring-1 ring-coral/20`. Keep error copy kind ("So close! Try again 🙂"), never harsh.
- **Pills / badges (play screens only; on parent pages use `.kids-plain-label` or coloured text)**: `rounded-full bg-slate-50 px-3 py-1 font-fun text-xs font-700 text-slate-500 ring-1 ring-slate-100`.

## Motion

- **Hover**: `transition hover:scale-105` (buttons) / `hover:scale-[1.02-1.03]` (cards). Snappy and inviting.
- **Idle delight**: gentle bob/float on decorative emoji via the `float` / `er-float` keyframes already in globals.css — small amplitude, slow. Stars/confetti on a win are welcome.
- **Tone**: bouncy and playful is GOOD here (the opposite of the admin theme). Keep it readable and not nauseating — no scroll-jacking, no fast strobing.

## What NOT to do (bans)

- ❌ Anything from `ai-cms`'s design: cyan and electric purple, near-black backgrounds, glows, grid backgrounds, Exo 2 or Inter.
- ❌ Hard borders, sharp corners, tiny dense controls. Everything is rounded; play screens are also big and breathable, while parent pages stay compact.
- ❌ Cold/clinical copy or scary red error states. Be warm and encouraging.
- ❌ Off-palette colours (random teals, hot magentas) outside the token set above.
- ❌ Low contrast — keep headings `slate-800/900` on white so kids can read easily.

## When invoked

When asked to build or refresh a public/kid/learner UI:

1. Re-read the tokens above; build on `bg-white` cards over the `cream` page.
2. Pick ONE accent colour for the feature and use it for its emoji tile, ring, and selected state.
3. `font-fun font-700` for titles/buttons, `font-round` for body.
4. Round everything (`rounded-3xl` / `rounded-full`), add `shadow-sm ring-1`, and a `hover:scale` on interactive elements.
5. Add an emoji or two for warmth, and a gentle hover/float.
6. On parent-facing pages, run the `tia-frontend-design` checks for dead space, gaps, chips, motion, dead links and inherited content.
7. Stress-test on mobile (375px): tap targets ≥ 44px, text never overflows, cards stack cleanly.

Good references already in the repo: the Brain Arcade hub ([src/app/learn/cards/page.tsx](src/app/learn/cards/page.tsx)), the card game player, the escape-room player, and the unified login ([src/app/login/page.tsx](src/app/login/page.tsx)).

---

### The admin back-office

The dark sci-fi theme inherited from `ai-cms` has been removed. `/admin` now uses the family theme: the tokens in `globals.css` are light, and fonts are Fraunces and Nunito.

- The wrapper is still called `.admin-shell`. Admin markup still has utilities like `text-white` and `bg-white/5`, which [admin-theme.css](src/app/admin-theme.css) maps to the light palette. Tailwind compiles opacity utilities to fixed colours, so a new one needs its own rule there.
- For new admin UI, use `--color-*` tokens, `.glass` for panels and `.btn-primary` or `.ti-btn` for buttons. Don't add new `text-white` or `bg-white/N` classes.
- `.prose-dark` is only a name now: it renders CMS HTML in the light palette.

### Sign-in pages

[login/page.tsx](src/app/login/page.tsx) with [FamilyLoginForm.tsx](src/components/public/FamilyLoginForm.tsx), and [admin/login/page.tsx](src/app/admin/login/page.tsx), share the `.kids-signin` classes: a welcome column on the left and the form on the right. Parent is the default tab. Write for parents, in plain and friendly language.
