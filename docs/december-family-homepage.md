# December family homepage redesign

Implemented 2 November 2026 for AI Kids Academy in this repository. The reference was https://alfredang.github.io/financial-planning/v2/: its rounded buttons, simple flow and cheerful character inspired a warmer family scrapbook design. No financial-planning text, statistics or testimonials were copied.

## What is available

- Homepage at http://localhost:3080/ with a large photorealistic Singapore family banner.
- Four workshop concepts with album cards, interest filters, individual detail pages and workshop-specific enquiry forms.
- Creative story writing, creative content generation, maths reasoning and introductory AI science.
- Prepared, interactive story and maths previews. They do not make live AI API calls.
- Printable free family activity pack at `/downloads/family-ai-starter-pack.html`.
- Parent enquiry and optional starter-pack follow-up forms call the existing `/api/contact` endpoint, which stores leads and attempts the existing configured staff notification.
- Lead source codes `december-holiday-workshop` and `family-ai-starter-pack`, with friendly labels merged into existing configured labels.
- Pip: an original kid explorer SVG mascot with rosy cheeks, a star cap, suggested questions, typed question matching and an explicit WhatsApp handoff. Its quick answers are local prepared content. It does not call the unrelated legacy business chatbot.
- WhatsApp +65 8866 6375 verified directly at https://www.tertiarycourses.com.sg/ on 2 November 2026. Existing configured numbers still take precedence over the verified fallback.
- Workshop dates, fees, duration and location remain on enquiry; no schedule or availability was fabricated. Enquiries do not buy or reserve a place.
- Learner game logic, authentication, booking/payment flows, admin theme and child API contracts were not modified.

## Project-local skills

Installed under `.agents/skills/`:

1. `ui-ux-pro-max` — requested nextlevelbuilder source, using project-local `npx skills add`.
2. `kids-book-writer` — requested jamesrochabrun source, using project-local `npx skills add`.
3. `lead-magnets` — requested coreyhaines31 source, using project-local `npx skills add`.
4. `children-story-creator` — manually installed published SKILL.md snapshot from https://api.skillmd.com/api/skills/lensetek/children-story-creator/raw after both requested/canonical Git URLs and GitHub API/raw endpoints failed with authentication/404 responses. Compared with the complete GitHub-page instruction text retrieved in-session. The mirror identifies upstream snapshot `754fc3c8e4`. See `.agents/skills/children-story-creator/INSTALLATION.md` for limitations: repository-level book-export helpers/templates are unavailable; writing guidance works. Do not describe this snapshot as a successful npx upstream install.

Project-local skills will be discoverable on the next turn; their instruction files were read directly for this implementation.

## Main banner asset and exact prompt

Generated using the built-in `image_gen` tool; then resized/encoded to WebP using Sharp without changing the scene.

Final project asset: `public/images/singapore-family-ai.webp` (1672 × 941, about 187 KB).

This is an AI-generated illustrative family scene, not a photo of actual customers. An earlier cartoon illustration was superseded and is not used by the site.

Exact generation prompt:

> Use case: photorealistic-natural. Asset type: large wide homepage photographic banner for Singapore parent-child AI learning workshops. PRIMARY REQUIREMENT: an entirely PHOTOREALISTIC natural lifestyle photograph. NO cartoon, NO illustration, NO drawing, NO animated style, NO 3D render. Real-looking Singaporean parents and primary school children learning together, photographed with a professional DSLR in warm natural morning light. Two multiethnic Singaporean families around a light oak communal table in a bright beautiful modern Singapore learning studio: a Chinese Singaporean mother beside her 8-year-old daughter, and a Malay Singaporean father beside his 9-year-old son. Four people total, dressed in casual warm cream, coral and sage clothing. Candid authentic affectionate interaction: the daughter points excitedly at a laptop screen, mum smiles with her; boy and dad work on a second tablet with a paper story sketch beside it. Real natural human faces, realistic skin pores and hair texture, believable hands and anatomy. Cozy environment with pale peach wall, books and tropical indoor greenery; soft large windows with subtle recognizable distant Singapore Marina Bay skyline in soft bokeh. Camera at table height, medium wide lifestyle shot, subjects central with entire heads and upper bodies visible, hands and devices visible, balanced wide landscape composition 16:9. Gentle warm pastel color grading, editorial family photography, premium educational campaign, welcoming and aspirational without stock-photo stiffness. No text, no logos, no watermarks, no overlaid graphic elements. Must look like an actual photograph of real families, never cartoonish.

## Validation

- Production build passed with existing Next middleware deprecation notice.
- TypeScript and `git diff --check` passed.
- Homepage, all four workshop pages, pack, image, programmes, login and privacy returned HTTP 200 locally.
- Browser screenshots reviewed at desktop and mobile widths.
- At 375, 768, 1024 and 1440 pixels, all hero images loaded and document width matched viewport width (no horizontal overflow).
- Mobile navigation opens and closes; December nav reaches the enquiry section.
- All four album cards show by default; Maths filter shows one; reset restores four.
- Story spark and maths hint/checked solution work.
- Pip quick replies select the correct workshop; handoff uses the verified WhatsApp number and carries the question into the prefilled message. Escape closes the panel and returns focus to the launcher. Panel fits a 375 × 667 viewport.
- Parent enquiry form: native required-field validation, simulated HTTP 503 message, successful retry, consent text and workshop/source payload verified through Playwright network interception.
- Starter-pack follow-up form: simulated failure retains free pack access; simulated success and correct source verified.
- No valid test submission reached the real contact endpoint. No test lead, email, WhatsApp message or external calendar event was created or sent.
- Real `/api/contact` rejected an empty payload with HTTP 400. The local leads table's required columns were verified read-only.

The code is implemented locally. No Git push or production deployment was performed, and live staff email delivery has not been claimed.
