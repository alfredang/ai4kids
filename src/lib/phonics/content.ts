/**
 * Phonics Quest — data for the offline, on-device phonics adventure (ages 4–6).
 *
 * A map of phonics "worlds", each a bite-size mini-game with gamified star
 * progression. Ported from the ai4kids Android app (PhonicsContent.kt); ideas
 * adapted from the PhonixQuest concept. That "ported from Android" is *origin,
 * not direction*: under the web-first flow (2026-07-17) new phonics changes land
 * HERE first, then port to Android — don't read it as "keep sending edits back".
 * Whole *words* are spoken with the
 * browser's SpeechSynthesis (it reads words fine), but isolated *sounds* play
 * pre-recorded clips from `public/phonics/phonemes` — TTS reads text as words
 * and so mangles a bare phoneme ("ah" ≠ /æ/). An optional Claude "Buddy" adds
 * hints/praise when AI is configured (see /api/learn/phonics-buddy).
 *
 * Audio is keyed by *phoneme*, never by letter — a letter has many sounds
 * (c = /k/ or /s/, g = /g/ or /dʒ/, every vowel), so only a phoneme slug is
 * unambiguous.
 */

/** The mini-game kinds a world can use. */
export type PhonicsKind = "pop" | "build" | "rhyme" | "listen" | "blend" | "digraph";

/** "Pop the Phoneme" round: which starting *sound* does this picture make?
 *  `options` and `answer` are phoneme slugs — keyed by sound, not letter, since
 *  the child decides by ear. `letter` is the grapheme that sound maps to in this
 *  word (e.g. Cat → "C" for the /k/ sound), used only for the Buddy hint. */
export type PopRound = {
  emoji: string;
  word: string;
  answer: string;
  options: string[];
  letter: string;
};

/** "Build the Word" round: build the word from letter tiles by *sound*. As each
 *  correct letter lands, its phoneme clip plays (blending, not letter names);
 *  `sounds` has one phoneme slug per letter of `word`, with "" marking a silent
 *  letter (e.g. the B in LAMB) — those play no sound, which teaches the silence. */
export type BuildRound = { emoji: string; word: string; sounds: string[] };

/** "Rhyme Time" round: pick the option that rhymes with the target. */
export type RhymeRound = {
  emoji: string;
  word: string;
  options: { emoji: string; word: string }[];
  answerIndex: number;
};

/** "Listen & Find" round: hear the word, then tap the matching word among
 *  similar-sounding choices (no pictures — the child decides by listening). */
export type ListenRound = {
  word: string;
  options: string[];
  answerIndex: number;
};

/** "Sound Blender" round: hear each sound, blend them, then tap the matching
 *  picture — decoded purely by ear (no letters shown). */
export type BlendRound = {
  word: string;
  sounds: string[];
  options: { emoji: string; word: string }[];
  answerIndex: number;
};

/** "Sound Buddies" round: hear a two-letter (digraph) sound, then pick the letter
 *  team that spells it — the child must map the sound to its spelling, so there's
 *  no read-the-word shortcut. The example emoji/word reinforce it on a win. */
export type DigraphRound = {
  sound: string;
  teams: string[];
  answerIndex: number;
  exampleEmoji: string;
  exampleWord: string;
};

/** One world on the adventure map. Only the list matching `kind` is populated. */
export type PhonicsStage = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  /** Accent token name — keyed into ACCENTS in the page for literal classes. */
  accent: AccentKey;
  kind: PhonicsKind;
  pop?: PopRound[];
  build?: BuildRound[];
  rhyme?: RhymeRound[];
  listen?: ListenRound[];
  blend?: BlendRound[];
  digraph?: DigraphRound[];
};

export type AccentKey = "bubble" | "tangerine" | "grape" | "mint" | "sky" | "teal";

/** How many rounds a stage has (drives the progress bar). */
export function stageRounds(s: PhonicsStage): number {
  switch (s.kind) {
    case "pop":
      return s.pop?.length ?? 0;
    case "build":
      return s.build?.length ?? 0;
    case "rhyme":
      return s.rhyme?.length ?? 0;
    case "listen":
      return s.listen?.length ?? 0;
    case "blend":
      return s.blend?.length ?? 0;
    case "digraph":
      return s.digraph?.length ?? 0;
  }
}

/** The seven worlds of Phonics Quest. */
export const PHONICS_STAGES: PhonicsStage[] = [
  {
    id: "letters-land",
    title: "Letters Land",
    subtitle: "Starting sounds",
    emoji: "🅰️",
    accent: "bubble",
    kind: "pop",
    // Distractors are phonemes that clearly *sound* different from the answer (a
    // child picks by ear), e.g. Cat's /k/ vs /t/ and /s/ — not the old C/K/T,
    // since C and K are the same /k/ sound.
    pop: [
      { emoji: "🍎", word: "Apple", answer: "v_a_short", options: ["v_a_short", "c_b", "c_s"], letter: "A" },
      { emoji: "🐻", word: "Bear", answer: "c_b", options: ["c_b", "c_d", "c_m"], letter: "B" },
      { emoji: "🐱", word: "Cat", answer: "c_k", options: ["c_k", "c_t", "c_s"], letter: "C" },
      { emoji: "🐶", word: "Dog", answer: "c_d", options: ["c_d", "c_b", "c_p"], letter: "D" },
      { emoji: "🥚", word: "Egg", answer: "v_e_short", options: ["v_e_short", "v_a_short", "v_i_short"], letter: "E" },
      { emoji: "🌙", word: "Moon", answer: "c_m", options: ["c_m", "c_n", "c_w"], letter: "M" },
    ],
  },
  {
    id: "blend-bridge",
    title: "Blend Bridge",
    subtitle: "Build short words",
    emoji: "🌉",
    accent: "tangerine",
    kind: "build",
    // CVC words: one sound per letter, so tapping a tile sounds it out and a full
    // build blends into the word (/k/-/æ/-/t/ → "cat").
    build: [
      { emoji: "🐱", word: "CAT", sounds: ["c_k", "v_a_short", "c_t"] },
      { emoji: "🐶", word: "DOG", sounds: ["c_d", "v_o_short", "c_g"] },
      { emoji: "☀️", word: "SUN", sounds: ["c_s", "v_u_short", "c_n"] },
      { emoji: "🎩", word: "HAT", sounds: ["c_h", "v_a_short", "c_t"] },
      { emoji: "🚌", word: "BUS", sounds: ["c_b", "v_u_short", "c_s"] },
    ],
  },
  {
    id: "silent-letters",
    title: "Whisper Woods",
    subtitle: "Silent letters",
    emoji: "🤫",
    accent: "grape",
    kind: "build",
    // "" marks a silent letter — it plays no sound, so the child hears which
    // letters are silent while building the word.
    build: [
      { emoji: "🐑", word: "LAMB", sounds: ["c_l", "v_a_short", "c_m", ""] }, // silent B
      { emoji: "🔪", word: "KNIFE", sounds: ["", "c_n", "d_ie", "c_f", ""] }, // silent K, E
      { emoji: "👻", word: "GHOST", sounds: ["c_g", "", "d_oa", "c_s", "c_t"] }, // silent H
      { emoji: "🏰", word: "CASTLE", sounds: ["c_k", "v_ar", "c_s", "", "c_l", ""] }, // silent T, E
      { emoji: "✍️", word: "WRITE", sounds: ["", "c_r", "d_ie", "c_t", ""] }, // silent W, E
    ],
  },
  {
    id: "rhyme-road",
    title: "Rhyme Road",
    subtitle: "Words that rhyme",
    emoji: "🎵",
    accent: "mint",
    kind: "rhyme",
    rhyme: [
      { emoji: "🐱", word: "Cat", options: [{ emoji: "🎩", word: "Hat" }, { emoji: "🐶", word: "Dog" }, { emoji: "☀️", word: "Sun" }], answerIndex: 0 },
      { emoji: "⭐", word: "Star", options: [{ emoji: "🚗", word: "Car" }, { emoji: "🌙", word: "Moon" }, { emoji: "🐟", word: "Fish" }], answerIndex: 0 },
      { emoji: "🌳", word: "Tree", options: [{ emoji: "🐝", word: "Bee" }, { emoji: "🐱", word: "Cat" }, { emoji: "☀️", word: "Sun" }], answerIndex: 0 },
      { emoji: "🐸", word: "Frog", options: [{ emoji: "🪵", word: "Log" }, { emoji: "🐱", word: "Cat" }, { emoji: "⭐", word: "Star" }], answerIndex: 0 },
      { emoji: "🐌", word: "Snail", options: [{ emoji: "🐳", word: "Whale" }, { emoji: "🐶", word: "Dog" }, { emoji: "🐦", word: "Bird" }], answerIndex: 0 },
    ],
  },
  {
    id: "story-kingdom",
    title: "Story Kingdom",
    subtitle: "Listen & find",
    emoji: "👑",
    accent: "sky",
    kind: "listen",
    listen: [
      { word: "Sun", options: ["Sun", "Sock", "Sand"], answerIndex: 0 },
      { word: "Dog", options: ["Dog", "Dot", "Duck"], answerIndex: 0 },
      { word: "Tree", options: ["Tree", "Try", "Train"], answerIndex: 0 },
      { word: "Cat", options: ["Cat", "Cap", "Cot"], answerIndex: 0 },
      { word: "Bear", options: ["Bear", "Bee", "Boat"], answerIndex: 0 },
    ],
  },
  {
    id: "sound-blender",
    title: "Sound Blender",
    subtitle: "Blend sounds into words",
    emoji: "🌀",
    accent: "teal",
    kind: "blend",
    // Hear /p/-/i/-/g/, blend it, tap the pig. Pure decoding of CVC words — fresh
    // words (only Dog carries over from Blend Bridge) so the child decodes by ear
    // rather than recalling the earlier build.
    blend: [
      { word: "Pig", sounds: ["c_p", "v_i_short", "c_g"], options: [{ emoji: "🐷", word: "Pig" }, { emoji: "🐶", word: "Dog" }, { emoji: "🐔", word: "Hen" }], answerIndex: 0 },
      { word: "Hen", sounds: ["c_h", "v_e_short", "c_n"], options: [{ emoji: "🐔", word: "Hen" }, { emoji: "🐷", word: "Pig" }, { emoji: "🐛", word: "Bug" }], answerIndex: 0 },
      { word: "Bug", sounds: ["c_b", "v_u_short", "c_g"], options: [{ emoji: "🐛", word: "Bug" }, { emoji: "🐷", word: "Pig" }, { emoji: "🥤", word: "Cup" }], answerIndex: 0 },
      { word: "Cup", sounds: ["c_k", "v_u_short", "c_p"], options: [{ emoji: "🥤", word: "Cup" }, { emoji: "🐛", word: "Bug" }, { emoji: "🐶", word: "Dog" }], answerIndex: 0 },
      { word: "Dog", sounds: ["c_d", "v_o_short", "c_g"], options: [{ emoji: "🐶", word: "Dog" }, { emoji: "🐷", word: "Pig" }, { emoji: "🐔", word: "Hen" }], answerIndex: 0 },
    ],
  },
  {
    id: "sound-buddies",
    title: "Sound Buddies",
    subtitle: "Two letters, one sound",
    emoji: "🤝",
    accent: "grape",
    kind: "digraph",
    // Hear a digraph SOUND, pick the two letters that spell it. The child has to
    // map the sound to its spelling, so there's no read-the-word shortcut.
    digraph: [
      { sound: "c_sh", teams: ["sh", "ch", "th"], answerIndex: 0, exampleEmoji: "🚢", exampleWord: "Ship" },
      { sound: "c_ch", teams: ["ch", "sh", "th"], answerIndex: 0, exampleEmoji: "🍟", exampleWord: "Chip" },
      { sound: "c_th_unvoiced", teams: ["th", "sh", "ng"], answerIndex: 0, exampleEmoji: "🛁", exampleWord: "Bath" },
      { sound: "c_ng", teams: ["ng", "sh", "ch"], answerIndex: 0, exampleEmoji: "💍", exampleWord: "Ring" },
      { sound: "c_sh", teams: ["sh", "th", "ch"], answerIndex: 0, exampleEmoji: "🐟", exampleWord: "Fish" },
    ],
  },
];

/** The phoneme clip for a two-letter team, so a child can compare the choices. */
export function slugForTeam(team: string): string {
  const map: Record<string, string> = { sh: "c_sh", ch: "c_ch", th: "c_th_unvoiced", ng: "c_ng" };
  return map[team] ?? "";
}

/**
 * Every phoneme clip the quest can play, derived from the stages so it can't
 * drift. The player warms these on mount: the blend sequences cut each sound off
 * after a fixed gap, so a clip that still has to fetch and decode when it's asked
 * to play loses that time off the front and sounds clipped.
 */
export const PHONEME_SLUGS: string[] = Array.from(
  new Set(
    PHONICS_STAGES.flatMap((s) => [
      ...(s.pop ?? []).flatMap((r) => r.options),
      ...(s.build ?? []).flatMap((r) => r.sounds),
      ...(s.blend ?? []).flatMap((r) => r.sounds),
      ...(s.digraph ?? []).flatMap((r) => [r.sound, ...r.teams.map(slugForTeam)]),
    ]),
  ),
).filter(Boolean);

/** Stars from mistakes: 0 → 3 stars, 1–2 → 2 stars, else 1 star. */
export function starsForMistakes(mistakes: number): number {
  if (mistakes === 0) return 3;
  if (mistakes <= 2) return 2;
  return 1;
}
