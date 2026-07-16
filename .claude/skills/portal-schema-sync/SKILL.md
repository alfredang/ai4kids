---
name: portal-schema-sync
description: Keep src/db/schema.ts and scripts/ensure-portal-schema.cjs in sync so new tables/columns actually exist in production. Use whenever a change touches src/db/schema.ts — adding or altering a table or column, running db:push/db:generate, or committing schema work — and before any commit that includes schema.ts. Triggers: "add a table", "new column", "db:push", "schema change", "relation does not exist", "works locally but not in prod", "migration".
---

# Portal schema sync

## The trap this exists to prevent

**Editing `src/db/schema.ts` does not change any database.** It's a TypeScript
description. In this repo, production has **no Drizzle migration step at all**:

- The Dockerfile's CMD is `node ensure-portal-schema.cjs && node server.js` — no `drizzle-kit migrate`.
- `.gitignore` contains `*.sql`, so **every `drizzle/*.sql` migration is gitignored** and never leaves a dev machine. Only `drizzle/meta/*.json` snapshots are committed, and snapshots alone apply nothing.
- Therefore **`scripts/ensure-portal-schema.cjs` is the only thing that creates tables in production.** It runs idempotent `CREATE TABLE IF NOT EXISTS` DDL on every container boot.

A table added to `schema.ts` and `db:push`ed locally works perfectly on your
machine and **500s in production** with `relation "x" does not exist`. This has
already shipped three times: `learner_artworks`, `learner_buddy_messages` /
`learner_buddy_meta` (kids couldn't pick a buddy colour in prod), and nearly
`learner_stories`.

`drizzle/` is effectively **local dev bookkeeping**. Do not rely on it for prod.

## Required workflow for any `schema.ts` change

1. Make the `schema.ts` change and `db:push` (or direct SQL) for local dev.
2. **Add matching DDL to `scripts/ensure-portal-schema.cjs`** (see rules below).
3. Run the drift check — it must pass:
   ```bash
   npm run check:schema
   ```
4. Verify the DDL against a real Postgres before trusting it (see Verifying).
5. Only then commit. **Never commit a `schema.ts` table change without the boot-script DDL in the same commit.**

## Rules for the DDL

- **Always `IF NOT EXISTS`.** The script re-runs on every boot; it must be a no-op once applied. Never `DROP`, never destructive DDL — it runs unattended against prod on every deploy.
- **Static SQL only.** No interpolation, no user input (that's what makes it injection-safe).
- **New table** → `CREATE TABLE IF NOT EXISTS <t> (...)` plus any `CREATE INDEX IF NOT EXISTS`.
- **New column on a table the script already creates** → a `CREATE TABLE IF NOT EXISTS` **silently skips an existing table**, so the column would never appear on a DB from an earlier deploy. You **must also** add:
  ```js
  `ALTER TABLE <t> ADD COLUMN IF NOT EXISTS <col> <type>`,
  ```
  Add it to the `CREATE` block **and** as an `ALTER`, so both fresh and existing databases converge. This is exactly how `buddy_name`/`buddy_color` went missing in prod.
- **Only nullable columns, or columns with a `DEFAULT`.** `ADD COLUMN ... NOT NULL` without a default **fails on a table that already has rows**, and the boot script swallows errors — you'd get a silently broken deploy.
- Mirror `schema.ts` exactly: types, `NOT NULL`, FKs (`REFERENCES users(id) ON DELETE CASCADE`), and index names.

## Verifying before you commit

`npm run check:schema` is static analysis — it proves the DDL is *present*, not that it *runs*. Verify execution too:

- **Idempotency (local DB, table already exists):**
  ```bash
  node --env-file=.env scripts/ensure-portal-schema.cjs   # run twice; expect the "ensured" line both times
  ```
  Note this is a **no-op** for existing tables — it does NOT prove the CREATE works.
- **Fresh-create + legacy-upgrade (the states prod is actually in):** run the DDL inside a temp schema in a transaction you always `ROLLBACK`, so existing data is never touched. Check both:
  - *fresh* — no tables: does `CREATE` produce the right columns/indexes/FKs?
  - *legacy* — table exists without the new column: do the `ALTER`s add it, with rows preserved?

## Gotchas

- **`db:push` is currently broken here** — it emits spurious `DROP CONSTRAINT ... _not_null` statements on primary-key columns and aborts with `column "id" is in a primary key`. Fall back to direct SQL against the local DB, and remember that does nothing for prod.
- **The `*.sql` gitignore looks accidental** — it sits beside `wp-*.sql` / `tertiar2_*.sql` and appears aimed at WordPress dumps, catching Drizzle migrations as collateral. Don't "fix" it casually; un-ignoring migrations without adding a migrate step changes nothing, and adding one needs care against a DB that was provisioned by other means.
- **`BASE_TABLES` in the checker** lists the original CMS/portal tables that predate the boot script and already exist in prod. Adding a **new** table there to silence the check is almost always wrong — it will not exist in production.
- The boot script **logs failures but never blocks startup** (the app is meant to degrade, not die). So a broken DDL shows up as a running app that 500s on one feature — check deploy logs for `[ensure-schema] portal schema + activities ensured`.
- This covers **schema only**. Learner data (saved stories, artworks, buddy chats) is per-kid and never synced; prod starts empty. `/push-to-remote` syncs CMS content (menus/settings/pages/posts), not this.

## Quick reference

```bash
npm run check:schema                                  # drift check (no DB needed)
node --env-file=.env scripts/ensure-portal-schema.cjs # run the boot script locally
```

Files: [src/db/schema.ts](../../../src/db/schema.ts) (source of truth) ·
[scripts/ensure-portal-schema.cjs](../../../scripts/ensure-portal-schema.cjs) (what prod runs) ·
[scripts/check-portal-schema-drift.cjs](../../../scripts/check-portal-schema-drift.cjs) (the check)
