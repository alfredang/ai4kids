/**
 * Compute a 1-10 score for a lead based on the submission shape.
 * Higher = warmer / more likely to convert.
 *
 *  +1 base
 *  + length signal (longer + structured messages score higher)
 *  + keenness keywords (urgent, demo, quote, budget, etc.)
 *  + contact-detail bonuses (phone, company)
 *  - red-flag penalties (all caps, repeated chars, "test" content)
 */

const KEEN_KEYWORDS = [
  "interested",
  "interest",
  "urgent",
  "asap",
  "as soon as possible",
  "quote",
  "quotation",
  "proposal",
  "demo",
  "demonstration",
  "ready",
  "decision",
  "budget",
  "rfp",
  "tender",
  "engage",
  "engagement",
  "onboard",
  "kick off",
  "kickoff",
  "deadline",
  "timeline",
  "purchase",
  "buy",
  "subscription",
  "license",
  "implementation",
  "rollout",
  "schedule",
  "meeting",
  "call",
  "appointment",
];

const RED_FLAGS = [
  "lorem ipsum",
  "test test",
  "asdf",
  "qwerty",
  "spam",
];

export type LeadScoreInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  message?: string | null;
};

export function computeLeadScore(input: LeadScoreInput): number {
  const msg = (input.message ?? "").trim();
  const lower = msg.toLowerCase();

  let score = 1;

  // Length signal — diminishing returns, capped at +4
  const len = msg.length;
  if (len >= 30) score += 1;
  if (len >= 100) score += 1;
  if (len >= 250) score += 1;
  if (len >= 500) score += 1;

  // Keenness keywords (+1 each, cap +3)
  let keenHits = 0;
  for (const kw of KEEN_KEYWORDS) {
    if (lower.includes(kw)) keenHits++;
    if (keenHits >= 3) break;
  }
  score += keenHits;

  // Qualification-signal bonuses — each distinct factor surfaced in the
  // message adds +1 (cap +3): interest, use-case, budget, timeline, readiness.
  const QUALIFICATION_FACTORS: Array<RegExp> = [
    /\b(workshops?|class(es)?|programmes?|trial|story|stories|art|maths?|science|stem|coding|games?|phonics)\b/, // interest in an offer
    /\b(because|my (son|daughter|child|kid)|years? old|interested in|loves?|enjoys?|looking for|need to|trying to)\b/, // use case clarity
    /\b(budget|fees?|price|cost|s\$|sgd|\$\s?\d)\b/, // budget intent
    /\b(december|november|school holidays?|this (week|month|year)|next (week|month|year)|asap|dates?|when can|schedule)\b/, // timeline urgency
    /\b(sign up|register|enrol|book|join|reserve|siblings?)\b/, // readiness to join
  ];
  let factorHits = 0;
  for (const re of QUALIFICATION_FACTORS) {
    if (re.test(lower)) factorHits++;
  }
  score += Math.min(3, factorHits);

  // Contact-detail bonuses
  if ((input.phone ?? "").replace(/[^\d]/g, "").length >= 7) score += 1;
  if ((input.company ?? "").trim().length >= 2) score += 1;

  // Red-flag penalties
  for (const rf of RED_FLAGS) {
    if (lower.includes(rf)) {
      score -= 2;
      break;
    }
  }
  // All-caps shouting
  if (msg.length >= 20 && msg === msg.toUpperCase() && /[A-Z]/.test(msg)) score -= 1;
  // Repeated character spam (e.g. "aaaaaaa", "!!!!!!!!!")
  if (/(.)\1{6,}/.test(msg)) score -= 1;
  // Suspiciously short messages
  if (len < 10) score -= 1;

  return Math.max(1, Math.min(10, score));
}
