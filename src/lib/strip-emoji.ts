/**
 * Remove emoji / pictographs so text-to-speech doesn't read them aloud.
 * Pure + dependency-free so it's safe to import from both server (TTS route)
 * and client (browser speechSynthesis fallback). Display text keeps its emojis.
 */
export function stripForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "") // emoji & pictographs
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "") // flag regional indicators
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "") // skin-tone modifiers
    .replace(/[‍️︎⃣]/gu, "") // ZWJ, variation selectors, keycap
    .replace(/\s{2,}/g, " ")
    .trim();
}
