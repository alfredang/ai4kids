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
  // AI Art Studio gallery (/learn/art, /learn/gallery). Mirrors learner_artworks.
  `CREATE TABLE IF NOT EXISTS learner_artworks (
    id serial PRIMARY KEY,
    learner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_prompt text NOT NULL,
    prompt text NOT NULL,
    style text NOT NULL,
    r2_url text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS learner_artworks_learner_idx ON learner_artworks (learner_id)`,
  // Talking Buddy chat log + per-learner buddy state (/learn/buddy). Mirrors
  // learner_buddy_messages / learner_buddy_meta in schema.ts.
  `CREATE TABLE IF NOT EXISTS learner_buddy_messages (
    id serial PRIMARY KEY,
    learner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL,
    content text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS buddy_msg_learner_idx ON learner_buddy_messages (learner_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS learner_buddy_meta (
    learner_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    cleared_at timestamp,
    buddy_name text,
    buddy_color text
  )`,
  // The kid-chosen name/colour landed after the table did, so a DB created by an
  // earlier deploy has the table but not these columns — CREATE ... IF NOT EXISTS
  // would skip it. Both are nullable, so adding them is safe with rows present.
  `ALTER TABLE learner_buddy_meta ADD COLUMN IF NOT EXISTS buddy_name text`,
  `ALTER TABLE learner_buddy_meta ADD COLUMN IF NOT EXISTS buddy_color text`,
  // Stories saved from the Story Builder into "My Stories" (/learn/stories).
  // Mirrors learner_stories in schema.ts; `pages` holds the finished path as
  // [{ text, image, emojis }].
  `CREATE TABLE IF NOT EXISTS learner_stories (
    id serial PRIMARY KEY,
    learner_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(200) NOT NULL,
    pages jsonb NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS learner_stories_learner_idx ON learner_stories (learner_id)`,
  // Security: never let a user inserted without an explicit role default to
  // 'admin'. Idempotent — safe to re-run on every boot. Mirrors schema.ts.
  `ALTER TABLE users ALTER COLUMN role SET DEFAULT 'parent'`,
  // Code Quest (/learn/code-puzzles) went live after seed-portal.ts had already
  // created its row as a "coming soon" placeholder. That row pre-exists in prod,
  // so the ACTIVITY_SEED insert below can't reach it (ON CONFLICT DO NOTHING),
  // there's no admin activities editor, and `activities` isn't in the sync API —
  // this UPDATE is the only path to flipping it live. Guarded on live = false so
  // it's a one-time correction, not a per-boot overwrite; wrapped in a table
  // check because this script doesn't create `activities` (seed-portal.ts does),
  // and a throw here would abort the statements after it.
  `DO $$
   BEGIN
     IF to_regclass('public.activities') IS NOT NULL THEN
       UPDATE activities SET live = true, description = 'Plan the robot''s path to the star!'
         WHERE slug = 'ai-coding' AND live = false;
     END IF;
   END $$`,
];

// Activity catalogue rows that aren't synced from elsewhere. Idempotent: new
// deploys add missing rows but never overwrite admin edits (ON CONFLICT DO
// NOTHING). Keep in sync with src/lib/card-games/meta.ts.
const ACTIVITY_SEED = [
  { slug: "cards-memory-match", title: "Memory Match", emoji: "🧠", desc: "Flip and find the pairs", order: 50 },
  { slug: "cards-tower-tumble", title: "Tower Tumble", emoji: "🃏", desc: "Climb the piles, empty your hand", order: 51 },
  { slug: "cards-number-hunt", title: "Number Hunt", emoji: "🔢", desc: "Make the target number", order: 52 },
  { slug: "cards-beat-the-die", title: "Beat the Die", emoji: "🎲", desc: "Roll, then beat it", order: 53 },
  { slug: "cards-card-showdown", title: "Card Showdown", emoji: "⭐", desc: "Clash for victory stars", order: 54 },
  { slug: "cards-matching-colours", title: "Matching Colours", emoji: "🌈", desc: "Quick! Tap the right colour", order: 55 },
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
         VALUES ($1, $2, 'free-games', $3, $4, true, true, $5)
         ON CONFLICT (slug) DO NOTHING`,
        [a.slug, a.title, a.emoji, a.desc, a.order],
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
