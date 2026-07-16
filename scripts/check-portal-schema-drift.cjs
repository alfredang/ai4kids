/**
 * Static drift check: schema.ts  <->  ensure-portal-schema.cjs
 *
 * Why this exists: production runs NO Drizzle migration step (the image's CMD is
 * `ensure-portal-schema.cjs && server.js`) and `drizzle/*.sql` is gitignored, so
 * migrations never leave a dev machine. That makes the boot script the ONLY
 * thing that creates tables in production — and a table added to schema.ts alone
 * silently 500s in prod on a missing relation. This has bitten learner_artworks,
 * learner_buddy_messages/meta and learner_stories.
 *
 * It checks two things, because both have actually broken:
 *   1. TABLE drift  — a table in schema.ts that the boot script never creates.
 *   2. COLUMN drift — a column added to a table the boot script already creates.
 *      `CREATE TABLE IF NOT EXISTS` silently skips an existing table, so newer
 *      columns need `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` too. This is
 *      exactly how buddy_name/buddy_color went missing in production.
 *
 * Pure static analysis — no DB connection, no env needed. Run: npm run check:schema
 */
const fs = require("fs");
const path = require("path");

const SCHEMA_PATH = path.join(__dirname, "..", "src", "db", "schema.ts");
const ENSURE_PATH = path.join(__dirname, "ensure-portal-schema.cjs");

/**
 * The original CMS + portal schema, already present in production before the
 * boot script existed; it deliberately does not recreate these.
 *
 * Adding a NEW table here is almost always WRONG — a new table won't exist in
 * production unless the boot script creates it. Only add here if the table is
 * genuinely provisioned some other way, and say how.
 */
const BASE_TABLES = new Set([
  "users", "categories", "tags", "pages", "posts", "post_tags",
  "menus", "menu_items", "media", "leads", "lead_blocklist", "settings",
  "blog_schedule_runs", "social_posts", "redirects",
  "parent_children", "programs", "classes", "bookings",
  "activities", "activity_completions", "achievements", "learner_achievements",
]);

/** Drizzle column constructors — deliberately excludes index()/uniqueIndex(). */
const COLUMN_CTOR = /(?:serial|text|varchar|integer|timestamp|jsonb|boolean|[A-Za-z]+Enum)\(\s*"([a-z_]+)"/g;

/** table name -> Set(column names) from schema.ts */
function parseSchema(src) {
  const tables = new Map();
  const re = /export const \w+ = pgTable\(\s*"([a-z_]+)"/g;
  const marks = [];
  let m;
  while ((m = re.exec(src))) marks.push({ name: m[1], start: m.index });

  for (let i = 0; i < marks.length; i++) {
    // Bound the block at the next `export const` so relations() and shared
    // column bags (e.g. contentColumns) can't leak columns into a table.
    const after = src.indexOf("\nexport const", marks[i].start + 1);
    const block = src.slice(marks[i].start, after === -1 ? src.length : after);
    const cols = new Set();
    let c;
    const ctor = new RegExp(COLUMN_CTOR.source, "g");
    while ((c = ctor.exec(block))) cols.add(c[1]);
    tables.set(marks[i].name, cols);
  }
  return tables;
}

/** table name -> text of its CREATE block + any ADD COLUMN statements */
function parseEnsure(src) {
  const tables = new Map();
  const re = /CREATE TABLE IF NOT EXISTS (\w+) \(/g;
  let m;
  while ((m = re.exec(src))) {
    // Each statement is a template literal, so the next backtick ends the block.
    const end = src.indexOf("`", m.index);
    tables.set(m[1], src.slice(m.index, end === -1 ? src.length : end));
  }
  const alter = /ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS (\w+)/g;
  while ((m = alter.exec(src))) {
    if (tables.has(m[1])) tables.set(m[1], tables.get(m[1]) + `\n${m[0]}`);
  }
  return tables;
}

const schema = parseSchema(fs.readFileSync(SCHEMA_PATH, "utf8"));
const ensured = parseEnsure(fs.readFileSync(ENSURE_PATH, "utf8"));
const errors = [];

for (const [table, cols] of schema) {
  if (BASE_TABLES.has(table)) continue;
  const ddl = ensured.get(table);
  if (!ddl) {
    errors.push(
      `TABLE "${table}" is in schema.ts but ensure-portal-schema.cjs never creates it.\n` +
        `    -> production will 500 with 'relation "${table}" does not exist'.\n` +
        `    -> add a CREATE TABLE IF NOT EXISTS ${table} (...) to scripts/ensure-portal-schema.cjs`,
    );
    continue;
  }
  const missing = [...cols].filter((c) => !new RegExp(`\\b${c}\\b`).test(ddl));
  if (missing.length) {
    errors.push(
      `COLUMN drift on "${table}": ${missing.join(", ")} in schema.ts but not in the boot script.\n` +
        `    -> CREATE TABLE IF NOT EXISTS skips existing tables, so add:\n` +
        missing.map((c) => `       ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${c} <type>`).join("\n"),
    );
  }
}

// A table the boot script creates but schema.ts no longer defines is dead DDL.
for (const table of ensured.keys()) {
  if (!schema.has(table)) errors.push(`STALE: boot script creates "${table}" but schema.ts has no such table.`);
}

if (errors.length) {
  console.error("\n✗ portal schema drift — production would not match schema.ts:\n");
  for (const e of errors) console.error("  • " + e + "\n");
  console.error("See .claude/skills/portal-schema-sync/SKILL.md\n");
  process.exit(1);
}

console.log(`✓ portal schema in sync (${ensured.size} tables ensured, ${BASE_TABLES.size} base tables exempt)`);
