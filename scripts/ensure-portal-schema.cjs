/**
 * Idempotent portal bootstrap, run once at container startup (see Dockerfile).
 *
 * The production image runs no Drizzle migration step (CMD is just the server),
 * so newer portal tables are created here on deploy. Everything is static
 * `CREATE ... IF NOT EXISTS` DDL — there is no string interpolation or user
 * input, so there is nothing to inject — and it is safe to run on every boot.
 *
 * It also upserts the few activity catalogue rows that don't come from a
 * synced source (escape rooms, Brain Arcade card games) so their tiles appear
 * in production without a manual `seed-portal` run. These are `ON CONFLICT DO
 * NOTHING`, so they never clobber edits made in the admin.
 *
 * Failures are logged but never block the server from starting (the app degrades
 * gracefully: solo escape rooms and the rest of the site work without these
 * tables; only co-op needs them).
 *
 * `schema.ts` remains the source of truth; keep these statements in sync with
 * the session table definitions there.
 */
const { Client } = require("pg");

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS escape_sessions (
    id serial PRIMARY KEY,
    code varchar(12) NOT NULL UNIQUE,
    room_slug varchar(255) NOT NULL,
    host_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(16) NOT NULL DEFAULT 'lobby',
    solved jsonb NOT NULL DEFAULT '[]'::jsonb,
    points integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS escape_sessions_code_idx ON escape_sessions (code)`,
  `CREATE TABLE IF NOT EXISTS escape_session_players (
    id serial PRIMARY KEY,
    session_id integer NOT NULL REFERENCES escape_sessions(id) ON DELETE CASCADE,
    learner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    avatar varchar(16),
    at_station varchar(64),
    joined_at timestamp NOT NULL DEFAULT now(),
    last_seen timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS escape_session_players_uq ON escape_session_players (session_id, learner_id)`,
  `CREATE INDEX IF NOT EXISTS escape_session_players_session_idx ON escape_session_players (session_id)`,
  // Card-game sessions (memory / discard / math). Mirrors card_sessions /
  // card_session_players in schema.ts; full game state lives in `state` jsonb.
  `CREATE TABLE IF NOT EXISTS card_sessions (
    id serial PRIMARY KEY,
    code varchar(12) NOT NULL UNIQUE,
    game_slug varchar(64) NOT NULL,
    mode varchar(16) NOT NULL DEFAULT 'versus',
    host_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status varchar(16) NOT NULL DEFAULT 'lobby',
    state jsonb,
    winners jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS card_sessions_code_idx ON card_sessions (code)`,
  `CREATE TABLE IF NOT EXISTS card_session_players (
    id serial PRIMARY KEY,
    session_id integer NOT NULL REFERENCES card_sessions(id) ON DELETE CASCADE,
    learner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name varchar(255) NOT NULL,
    avatar varchar(16),
    joined_at timestamp NOT NULL DEFAULT now(),
    last_seen timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS card_session_players_uq ON card_session_players (session_id, learner_id)`,
  `CREATE INDEX IF NOT EXISTS card_session_players_session_idx ON card_session_players (session_id)`,
  // Security: never let a user inserted without an explicit role default to
  // 'admin'. Idempotent — safe to re-run on every boot. Mirrors schema.ts.
  `ALTER TABLE users ALTER COLUMN role SET DEFAULT 'parent'`,
  // Ensure the program_category enum has every value the app uses. Enum
  // additions never reached prod (migrations aren't run on deploy), so seeding
  // an activity with category 'art' failed with "invalid input value for enum
  // program_category". ADD VALUE IF NOT EXISTS is idempotent; each runs in its
  // own autocommit statement so the new value is usable by later inserts.
  `ALTER TYPE program_category ADD VALUE IF NOT EXISTS 'storytelling'`,
  `ALTER TYPE program_category ADD VALUE IF NOT EXISTS 'art'`,
  `ALTER TYPE program_category ADD VALUE IF NOT EXISTS 'coding'`,
  `ALTER TYPE program_category ADD VALUE IF NOT EXISTS 'game-dev'`,
  `ALTER TYPE program_category ADD VALUE IF NOT EXISTS 'phonics'`,
  `ALTER TYPE program_category ADD VALUE IF NOT EXISTS 'escape-room'`,
  `ALTER TYPE program_category ADD VALUE IF NOT EXISTS 'free-games'`,
];

// Activity catalogue rows that aren't synced from elsewhere. Idempotent: new
// deploys add missing rows but never overwrite admin edits (ON CONFLICT DO
// NOTHING). Keep the learn activities in sync with scripts/seed-portal.ts and
// the card games with src/lib/card-games/meta.ts.
const ACTIVITY_SEED = [
  // Core learn activities (were previously only in the manual seed-portal run,
  // so freshly-deployed prod DBs were missing e.g. the AI Art Studio card).
  { slug: "ai-storytelling", title: "Story Time", category: "storytelling", emoji: "📖", desc: "Build a branching tale or write your own — illustrated by AI.", live: true, order: 0 },
  { slug: "ai-art", title: "AI Art Studio", category: "art", emoji: "🎨", desc: "Turn your ideas into pictures with AI.", live: true, order: 1 },
  { slug: "ai-phonics", title: "Phonics Quest", category: "phonics", emoji: "🔤", desc: "Travel the worlds and master every sound!", live: true, order: 2 },
  { slug: "ai-coding", title: "AI Code Quest", category: "coding", emoji: "💻", desc: "Build with code blocks (coming soon).", live: false, order: 3 },
  { slug: "ai-game-dev", title: "AI Game Maker", category: "game-dev", emoji: "🎮", desc: "Make your own game (coming soon).", live: false, order: 4 },
  { slug: "ai-jigsaw", title: "AI Jigsaw", category: "art", emoji: "🧩", desc: "Turn your art into a puzzle!", live: true, order: 5 },
  { slug: "ai-buddy", title: "Talking Buddy", category: "storytelling", emoji: "🤖", desc: "Chat with an AI friend!", live: true, order: 6 },
  // Brain Arcade card games.
  { slug: "cards-memory-match", title: "Memory Match", category: "free-games", emoji: "🧠", desc: "Flip and find the pairs", live: true, order: 50 },
  { slug: "cards-tower-tumble", title: "Tower Tumble", category: "free-games", emoji: "🃏", desc: "Climb the piles, empty your hand", live: true, order: 51 },
  { slug: "cards-number-hunt", title: "Number Hunt", category: "free-games", emoji: "🔢", desc: "Make the target number", live: true, order: 52 },
  { slug: "cards-beat-the-die", title: "Beat the Die", category: "free-games", emoji: "🎲", desc: "Roll, then beat it", live: true, order: 53 },
  { slug: "cards-card-showdown", title: "Card Showdown", category: "free-games", emoji: "⭐", desc: "Clash for victory stars", live: true, order: 54 },
  { slug: "cards-matching-colours", title: "Matching Colours", category: "free-games", emoji: "🌈", desc: "Quick! Tap the right colour", live: true, order: 55 },
];

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[ensure-schema] DATABASE_URL not set; skipping");
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    for (const stmt of STATEMENTS) await client.query(stmt);
    for (const a of ACTIVITY_SEED) {
      await client.query(
        `INSERT INTO activities (slug, title, category, emoji, description, live, leaderboard_enabled, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)
         ON CONFLICT (slug) DO NOTHING`,
        [a.slug, a.title, a.category, a.emoji, a.desc, a.live, a.order],
      );
    }
    console.log("[ensure-schema] portal schema + activities ensured");
  } catch (err) {
    console.warn("[ensure-schema] skipped:", err && err.message ? err.message : err);
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
})();
