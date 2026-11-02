# Playful December family site — 3 November 2026

## Direction

User-directed revision of the AI Kids site: photorealistic banner first; big cute original logo; colourful type; compact spacing; fewer words; no small chips; irregular illustrated album; playful menu; clear December school holiday workshops; a fixed bottom-right WhatsApp helper.

Typography was measured directly from the user's own https://alfredang.github.io/financial-planning/v2/ and its https://github.com/alfredang/financial-planning source: Fraunces headings with soft/wonky axes, Nunito body/menu, body 17px, menu 17px, card copy 16px, hero introduction 20.8px, desktop H1 62.4px, section headings up to 44.8px. These measurements guide readability; the brand mark, illustrations, layouts and copy are original to AI Kids.

The current palette uses light sky blue, mint, lavender, rainbow accents and sunny yellow. The previous large orange enquiry panel is mint. Primary copy is purple, teal, berry and indigo. Repetitive three-step marketing content was removed. Section padding is usually 20–29px rather than 65–85px.

## Implemented

- Three photorealistic Singapore workshop images with visible AI storybook and maths interfaces.
- Tetris-style falling photo tiles between three photos, automatic rotation, previous/next and pause controls; rotation pauses on hover, focus, offscreen, hidden document, reduced motion and the global motion control.
- Images precede the main heading. The December workshop album has a clear nav entry and visible heading.
- Original sunny bookworm logo, rainbow lettering and original SVG menu illustrations.
- Four compact illustrated album pages: Storybook Studio, Mini Maker Studio, Maths Detectives, Science Explorers. Artwork is original SVG, scalable at any resolution.
- Gentle artwork motion, twinkling stars, hover movement and scroll entrances, with reduced-motion support and a pause control.
- A smiling mint toybox replaces four identical free-tool marketing cards.
- Parent form, workshop details, family contact page and catalogue filters use the updated family identity.
- Catalogue filters and workshop metadata are plain text / underlined links, without small chip styling.
- Pip remains fixed to the bottom right and connects to +65 8866 6375. Its greeting bubble collapses when the footer is visible, leaving footer links unobstructed.
- Parent leads continue through the existing API. One authorised live QA enquiry was saved; email delivery is awaiting a refreshed Gmail OAuth connection. No delivery success is claimed.

The user confirmed there are no genuine parent testimonials available. None were fabricated. The workshop project outcomes serve as the visible showcase instead.

December dates, fees, venues and session lengths have not been supplied, so the site asks parents to enquire. It does not fabricate available seats, scheduled cohorts, sales, reviews or bookings.

## Image delivery and provenance

Generated with the built-in `image_gen` tool. Source outputs returned **1672 × 941**, despite a larger size requested in the prompts. Delivery assets were resized to **3840 × 2160** using Sharp's Lanczos resampling and mild sharpening, then encoded as WebP quality 94; Next image delivery uses quality 90. These are upscaled delivery files, **not a claim of native 4K generated detail**. Original generated files remain in Codex's generated_images directory.

Final project files:

- `public/images/family-ai-banner.webp`
- `public/images/story-workshop-banner.webp`
- `public/images/maths-workshop-banner.webp`

The photos are AI-generated illustrative scenes, not actual customer photographs or testimonials.

### Family image edit prompt

Edit this photograph into an ultra high resolution 3840 x 2160 pixel wide 4K website banner. Preserve exactly the scene, the four Singaporean family members, identities, warm natural lighting, positions, tabletop, laptop and tablet, and subtle Marina Bay Sands skyline. Enhance sharpness and fine realistic detail in faces, hair, clothing, paper and tropical plants. Do not change the scene or add new people. This must be a photorealistic professional family education photograph, never a cartoon or illustration. Natural realistic skin texture and hands. No text, no watermark. Main request is true higher pixel resolution and crisp photographic detail for a large desktop website banner. Output 3840x2160.

### Story workshop generation prompt

Use case photorealistic-natural. Create a truly crisp high resolution 3840x2160 pixel landscape photographic homepage banner of a Singapore parent and child at a creative STORY WRITING WITH AI workshop. Realistic Chinese Singaporean mum and her excited 8-year-old daughter seated at a light wood learning table, viewed from a slightly elevated side-front camera angle so their real smiling faces AND the laptop display are both clearly visible. The daughter holds a pencil above a three-panel original story sketch of a cute Merlion and a rainbow. The laptop display clearly shows an illustrated digital children's storybook with the SAME Merlion character on the left and a friendly AI writing-helper interface on the right, using simple icon blocks and suggestion bubbles with tiny nonreadable text. An actual learning workshop, not generic family screen time. A friendly Malay Singaporean facilitator is gently guiding them at the table edge, natural real skin and anatomy, candid happy faces. Bright beautiful Singapore workshop studio with books, craft paper and plants; subtle modern Singapore skyline through window. Peach-free palette: soft warm white, pale yellow, sage and hints of lilac clothing. Professional editorial DSLR family photography, sharp focus on people and screen, realistic textures, natural daylight, clean warm highlights, not hazy, not blurry. Wide 16:9 banner composition with all heads safe in central 80%, some breathing room above. No cartoon, no illustration, no 3D. No overlaid text or logos. Output 3840x2160 true 4K detail.

### Maths workshop generation prompt

Use case photorealistic-natural. Create a truly crisp high resolution 3840x2160 pixel landscape photographic homepage banner for an AI MATHS workshop for Singapore parents and children. Realistic Malay Singaporean dad and his cheerful 9-year-old son seated side by side at a light wooden classroom table. A Chinese Singaporean female facilitator helps them. Camera three-quarter front view arranged to see real friendly faces AND a laptop screen with a clear bright visual maths learning interface: three colourful bowl illustrations each with a 4 coin icon, a row of coins, Singapore-style maths BAR MODELS, a friendly small AI hint helper in a side column, visual shapes and blocks. Tiny screen labels need not be readable. The child is pointing to his handwritten bar model and simple arithmetic on a paper worksheet while dad follows with a pencil. Clearly depicts a supervised AI maths learning workshop and reasoning, not generic device use. Background sunny modern Singapore learning space, subtle shelves of educational toys and tropical plants. Warm sunlight but no orange cast. Colours are warm white, mint, lilac, yellow. Professional editorial DSLR family education photography. Crisp sharp fine skin texture and hair detail, believable hands, tablet/laptop real geometry, authentic joyful concentration. Wide landscape 16:9 with heads safely inside central 80%. No cartoons, no illustrations, no 3D, no hazy treatment, no blurry people or screens. No overlaid headlines, watermarks or logos. Output 3840x2160 true 4K detail.

## Validation evidence

- Production build and TypeScript passed; only the pre-existing Next middleware convention deprecation notice remains.
- Exact reference fonts/sizes were confirmed by browser computed styles.
- At 375, 768, 1024 and 1440px widths, document width equals viewport width.
- Automatic banner rotation reached the story slide after its interval; manual next reached both story and maths; the liquid reveal was rendered; pause exposed the play control.
- Mobile menu opens, includes December workshops and closes after navigation.
- Maths filter shows one workshop, reset shows all four.
- Pip opens on mobile, gives a maths workshop reply and uses the verified WhatsApp handoff URL. Escape restores focus.
- Scrolling to the true document bottom on desktop and mobile exposes the footer; no vertical clipping or horizontal overflow was found. The helper's speech bubble hides there to avoid covering legal/navigation links.
- The original mocked parent form success/failure, consent, source attribution and native validation checks remain applicable; submission implementation was preserved.

This is a local revision at http://localhost:3080/. No Git push or production deployment was performed.

## 3 November release checks

- Sky-blue, rainbow and lavender theme shared across public pages, parent area and playground; original SVG icon vocabulary plus four generated workshop characters replace stock decorative symbols.
- Badge artwork retains official proportions; both visible badges measure 40px high.
- Latest requested banner transition: 24 Tetris-style photo tiles drop into place, then resolve into a sharp full photograph. Reduced-motion support retained.
- Parent authentication and a database-verified owned child selection are required on game pages and APIs. Anonymous, child-only and unselected parent requests return 403.
- Real DeepSeek V4.1 Flash (`deepseek-flash`) chat, branching story, original three-scene story and six phonics hint modes returned successful responses. Unsafe chat request redirected safely.
- Ten card-game routes render and initialise; Card Showdown verified with three players. Six escape rooms create/start/solve/finish successfully through their APIs.
- Local artwork generation falls back without a configured image provider; DeepSeek is the text provider, not an image generator.
- Canonical host and sitemap corrected; four workshop pages cover story writing, math, science and creative content without invented reviews, dates or fees.

## Live release and Pip follow-up

The family website was pushed as `fff8142` and verified on https://ai4kids.tertiarycourses.com.sg/ on 3 November 2026. Production readback confirmed the new homepage, Games navigation, sunny favicon, all three photo assets and the corrected sitemap. Anonymous production game requests return 403. The DeepSeek key is encrypted in the production database and read back successfully without exposing its value.

Pip now periodically slides out an invitation for 6.5 seconds, about every 21 seconds. Opening the helper pauses invitations; hidden tabs, focused forms, footer overlap and reduced-motion settings suppress automatic prompts. A browser test measured opacity 0 → 1 → 0.

Production enquiry QA: the form returned 200 and displayed its success state. The configured destination is `angch@tertiaryinfotech.com`, with no CC. Production has no Gmail sending credentials. The existing company connection tested with `invalid_grant`; it was not copied into this app. A fresh Gmail connection is required to complete delivery testing.
