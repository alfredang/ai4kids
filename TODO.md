# TODO — Android parity

**Clear the items below before starting new work on `/learn/*` or `/api/learn/*`.**
They are cheap now and get expensive once more drift stacks on top of them.

## Why this file exists

The Android app (**`ai4kids_android`**, sibling checkout — typically
`../ai4kids_android`) is a **downstream consumer of this repo**. It mirrors:

- the `/learn/*` games' **behaviour** (rules, interaction, timing, scoring), and
- the `/api/learn/*` **request/response contract** — Android hand-parses JSON, so
  a field rename here silently breaks a *shipped* app in users' hands.

As of **2026-07-17** the agreed flow is **web first, then port to Android** — this
repo is the origin for new work. That flow only holds if the two don't quietly
diverge between ports.

The failure this guards against actually happened: in July 2026 a port found
`src/lib/phonics/content.ts` **byte-identical** to Android's `PhonicsContent.kt`
— same seven worlds, same rounds, same 44 phoneme clips — while
`PhonicsQuest.tsx` had gained a whole **tap-to-arm** mechanic (first tap hears the
letter, second commits it), a slower playback rate, and end-timed sound gaps that
Android never had. **The data matched; the behaviour didn't.** A game's data and
its behaviour drift independently, and only one of them is easy to diff.

## Before you change anything under `/learn/*`

- [ ] Does the game have an Android counterpart? (phonics, storytelling, code
      puzzles, buddy, art, cards, escape-room all do.)
- [ ] If you change **behaviour**, note it in the PR/commit body so the port
      isn't reverse-engineered from a diff later.
- [ ] If you change an **`/api/learn/*` Zod schema or response shape**, treat it
      as a breaking change to a deployed client — Android must ship in step.

## Resolved

- **AI art returned a blank image (`finishReason: CONTENT_FILTERED`).** The
  `buildPrompt` wrapper in [src/lib/kid-image.ts] named the banned concepts to
  forbid them ("nothing scary, violent or unsafe"), which trips FLUX.1-dev's
  keyword safety filter — it then returns a ~6 KB solid frame instead of the
  picture. Diagnosed on the Android port (device logcat: HTTP 200,
  `CONTENT_FILTERED`, 6428-byte JPEG) and fixed on **both** sides by switching to
  positive-only framing. This is the first concrete payoff of tracking the
  never-verified NVIDIA path here.

- **"Try the other path" only rewound to the second fork.** `replayFork` dropped
  just the last choice (`chosen.slice(0, -1)`), so from a finished tale the child
  could flip the second decision but never reach either ending under the first
  choice without a full rebuild. Now resets `chosen` to `[]` and jumps to
  `forks[0]`, so a replay retakes both decisions and all four endings are
  reachable. Pure UI/interaction change — no `/api/learn/*` contract or
  `buildTimeline` change. Ported to Android's `StoryBuilderScreen.kt` in step
  (`compileDebugKotlin` + `StoryEngineTest` green; the test's `rewoundTwice` case
  already covered the full-rewind primitive).

## Outstanding drift

### 1. Story Builder has no guard here, but does on Android

`src/lib/story-builder/templates.ts` (`buildStory`, `secondFork`) and the
timeline logic in `src/app/learn/storytelling/page.tsx` have **zero** test
coverage. Android's `StoryEngine.kt` now has 20 JUnit tests covering exactly this
logic — the two-fork tree, timeline flattening, rewind-to-fork, and the `an()`
article helper.

So the *downstream port is better guarded than the upstream source*, which is
backwards under a web-first flow: a broken fork tree here ships before anything
catches it.

- [x] Add `check:story-builder` (tsx script, mirroring the existing
      `check:code-puzzles` idiom — this repo has no test runner) asserting:
  - every path forks twice and terminates in a page containing `The End!`
  - all four leaf paths are reachable and non-empty
  - `buildTimeline(story, chosen).forks[k]` always indexes a problem page
  - rewinding one choice lands back on the fork just answered
  - `an()` never emits `a island` for a vowel-initial place
- [x] Wire it into CI/lint alongside `check:code-puzzles`. (Added as the
      `check:story-builder` npm script; there is no CI workflow, same as
      `check:code-puzzles`.)

### 2. The data/behaviour split differs from Android

`buildTimeline` and `remainingFrom` live in `page.tsx` (UI) here, but in
`StoryEngine.kt` (pure, testable) on Android. That mismatch means `templates.ts`
can't be diffed 1:1 against the Kotlin engine, and the timeline logic can't be
covered by item 1 while it sits in a client component.

- [x] Move `buildTimeline` / `remainingFrom` / `ForkNode` into
      `src/lib/story-builder/` so the split matches Android and the logic is
      reachable from a `check:` script. (Moved into `templates.ts`, mirroring
      `StoryEngine.kt`'s single pure module.)

### 3. File headers state a direction that no longer applies to new work

`src/lib/phonics/content.ts` opens with *"Ported from the ai4kids Android app
(PhonicsContent.kt)"*. True as history — and it is why phonics content flowed
Android → web — but under web-first it reads as an instruction to keep sending
content the other way.

- [x] Add a line to that header (and `src/lib/code-puzzles.ts`) recording the
      historical origin **and** that new changes now land here first.
      (`code-puzzles.ts` notes the opposite — it's the deliberate Android-first
      exception.)

> **Real exception, do not "fix":** Code Puzzles is an Android original.
> `CodePuzzlesEngine.kt` remains the source of truth for its rules and `LEVELS`;
> `npm run check:code-puzzles` stands in for the Kotlin test. Edit LEVELS on
> either side → re-run both guards.

### 4. This repo has no skill telling anyone Android exists

Android has a `web-parity` skill; there's no counterpart here, and `CLAUDE.md`
mentioned Android nowhere until this file was added. Nothing warns someone editing
`/api/learn/cards/move` that a shipped client parses that JSON by hand.

- [x] Add an `android-parity` skill (or a CLAUDE.md section) covering: the
      downstream consumer, the two-layer data/behaviour rule, and the
      `/api/learn/*` contract being load-bearing for a released app.
      (Done as the CLAUDE.md "The Android app is a downstream consumer of
      `/learn`" section — covers all three points.)

### 5. "Write your own" sends the child's free text to the model with no gate

`/api/learn/storytelling` passes the typed `prompt` straight into `askClaudeJson`
— relying on Claude's own refusal for anything unsafe. The Android port added a
pre-gate: it runs the idea through a kid-safety classifier
(`GeminiClient.classifyStoryIdea`) *before* generating, and blocks with a kind
message if it comes back unsafe. This is the one spot where a child's free text
(not menu picks) reaches a model, so a belt-and-braces check is cheap insurance.

Android is **ahead** here; web should adopt the same gate rather than the reverse.

- [ ] Add a lightweight safety classify step to the storytelling route (mirror
      the art route's existing `classify`-style check), blocking unsafe ideas
      before the story call.

## Deliberate divergences — Android is NOT behind, don't "port" these

Recorded so nobody reads them as drift and tries to close the gap:

| Web feature | Why Android doesn't have it |
| --- | --- |
| Story illustrations (`/api/learn/story-image`), read-aloud, **My Stories** save | Story Builder is part of Android's **offline core** — no account, nothing leaves the device |
| "Write your own" mode (free-text → 3-scene story) | Web-only merge of two former activities; a product decision, not parity debt |
| Per-learner phonics progress, `/api/learn/score` + leaderboard | Android keeps the star tally in local `SharedPreferences`; the offline core collects nothing |
| Claude (`askClaudeJson`) for story/buddy generation | Android calls **Gemini on-device**; keys live in git-ignored `local.properties` |
| Server TTS (Aura-2) | Android uses on-device `TextToSpeech` — strictly more private |

Android also carries one fix with **no web equivalent**: a superseded phoneme clip
hanging its caller. `MediaPlayer.release()` fires no callback, whereas pausing an
`HTMLAudioElement` emits `"pause"` and settles the promise — the web gets this
free and needs no change.

## Optional idea (NOT planned) — move kids-game image gen behind a server proxy

Captured so the option isn't lost, **not** a committed task. Today (2026-07-20) both
web and Android generate art on-device / with direct provider calls: the chain is
**NVIDIA FLUX.1-dev → Cloudflare Flux**, keys in the web vault ([src/lib/kid-image.ts])
and Android's `BuildConfig` (from git-ignored `local.properties`). Nano Banana
(Gemini image gen) was dropped from both because it needs billing.

The **only** real weakness of the on-device model: any key compiled into the APK is
extractable (decompile or intercept the request) — Play Store distribution does not
change that. If that ever matters, an **optional** future switch is a thin
attestation-gated image proxy:

- New `/api/app/art` endpoint (separate from the learner-gated `/api/learn/art`),
  auth'd by a **Play Integrity** token instead of a portal session — so it keeps
  Android's no-account model. Returns raw `{ imageBase64, mime }` (no public R2 URL).
- Verifies `PLAY_RECOGNIZED` + `MEETS_DEVICE_INTEGRITY` + a per-request `requestHash`,
  plus IP/global rate limits. Keys never leave the server; provider swaps become a
  one-place, zero-release change (kills art-provider drift).

**Trade-offs that make this optional, not obvious:** it re-introduces `/api/app/*`
contract coupling to a shipped client, adds a hard dependency on server uptime, and
needs Google Cloud + Play Integrity setup. **Cheap interim mitigation, do regardless:**
keep Android's image keys strictly free-tier / no-card and set billing caps, which
neutralises the financial worst case without any of the above.
