import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const statusEnum = pgEnum("status", ["draft", "published", "archived"]);
// Roles: admin (staff), parent, learner (kid). editor/author kept for backward
// compat with inherited CMS admin code.
export const roleEnum = pgEnum("role", [
  "admin",
  "editor",
  "author",
  "parent",
  "learner",
]);

// --- Kids-AI portal enums ---
export const programCategoryEnum = pgEnum("program_category", [
  "storytelling",
  "art",
  "coding",
  "game-dev",
  "phonics",
  "escape-room",
  "free-games",
]);
export const classStatusEnum = pgEnum("class_status", [
  "open",
  "full",
  "closed",
  "cancelled",
  "completed",
]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "awaiting_payment",
  "paid",
  "cancelled",
]);
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "follow_up",
  "contacted",
  "qualified",
  "converted",
  "lost",
]);
export const categoryTypeEnum = pgEnum("category_type", ["page", "post"]);
export const socialPlatformEnum = pgEnum("social_platform", [
  "linkedin",
  "facebook",
]);
export const socialPostStatusEnum = pgEnum("social_post_status", [
  "draft",
  "scheduled",
  "publishing",
  "published",
  "failed",
  "cancelled",
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    // Nullable: learners (kids) sign in with username, not email; Google
    // parents/admins have email but no password. Unique index allows many NULLs.
    email: varchar("email", { length: 255 }),
    username: varchar("username", { length: 64 }), // learner login handle
    passwordHash: text("password_hash"),
    name: varchar("name", { length: 255 }).notNull(),
    // Default to the LEAST-privileged role: a row inserted without an explicit
    // role must never become admin. Staff/parent/learner are set explicitly at
    // creation (seed, Google self-provision, admin "add staff").
    role: roleEnum("role").notNull().default("parent"),
    avatar: text("avatar"), // optional emoji/url for kid profile
    dob: timestamp("dob"), // learner date of birth
    ageGroup: varchar("age_group", { length: 16 }), // e.g. "4-6","7-9","10-12","13-16"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    uniqueIndex("users_username_uq").on(t.username),
  ],
);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  type: categoryTypeEnum("type").notNull().default("post"),
});

export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
});

// Generic SEO + content fields shared by pages and posts
const contentColumns = {
  slug: varchar("slug", { length: 255 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  excerpt: text("excerpt"),
  content: jsonb("content").notNull(), // TipTap JSON
  contentHtml: text("content_html"), // Rendered HTML cache
  status: statusEnum("status").notNull().default("draft"),
  seoTitle: varchar("seo_title", { length: 500 }),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  ogImage: text("og_image"),
  canonicalUrl: text("canonical_url"),
  noIndex: boolean("no_index").notNull().default(false),
  authorId: integer("author_id").references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
};

export const pages = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    ...contentColumns,
    categoryId: integer("category_id").references(() => categories.id),
  },
  (t) => [uniqueIndex("pages_slug_uq").on(t.slug)],
);

export const posts = pgTable(
  "posts",
  {
    id: serial("id").primaryKey(),
    ...contentColumns,
    featuredImage: text("featured_image"),
    categoryId: integer("category_id").references(() => categories.id),
    readingTime: integer("reading_time"),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    featured: boolean("featured").notNull().default(false),
  },
  (t) => [
    uniqueIndex("posts_slug_uq").on(t.slug),
    index("posts_status_published_idx").on(t.status, t.publishedAt),
  ],
);

export const postTags = pgTable(
  "post_tags",
  {
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("post_tags_pk").on(t.postId, t.tagId)],
);

export const menus = pgTable("menus", {
  id: serial("id").primaryKey(),
  location: varchar("location", { length: 50 }).notNull().unique(), // 'header' | 'footer'
  name: varchar("name", { length: 255 }).notNull(),
});

export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  menuId: integer("menu_id")
    .notNull()
    .references(() => menus.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  label: varchar("label", { length: 255 }).notNull(),
  href: text("href").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  openInNewTab: boolean("open_in_new_tab").notNull().default(false),
});

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 500 }).notNull(),
  path: text("path").notNull(),
  alt: text("alt"),
  mime: varchar("mime", { length: 100 }),
  width: integer("width"),
  height: integer("height"),
  sizeBytes: integer("size_bytes"),
  uploadedById: integer("uploaded_by_id").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 50 }),
    company: varchar("company", { length: 255 }),
    message: text("message"),
    source: varchar("source", { length: 100 }), // page slug
    status: leadStatusEnum("status").notNull().default("new"),
    notes: text("notes"),
    score: integer("score"), // 1-10, computed at intake / backfill
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("leads_status_created_idx").on(t.status, t.createdAt)],
);

export const leadBlocklist = pgTable(
  "lead_blocklist",
  {
    id: serial("id").primaryKey(),
    pattern: varchar("pattern", { length: 255 }).notNull(), // email or *@domain glob
    kind: varchar("kind", { length: 16 }).notNull(), // 'block' | 'allow'
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("lead_blocklist_pattern_uq").on(t.pattern, t.kind),
    index("lead_blocklist_kind_idx").on(t.kind),
  ],
);

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blogScheduleRuns = pgTable("blog_schedule_runs", {
  id: serial("id").primaryKey(),
  runAt: timestamp("run_at").defaultNow().notNull(),
  trigger: varchar("trigger", { length: 16 }).notNull(), // cron | http | manual
  status: varchar("status", { length: 16 }).notNull(),   // ok | skipped | error
  videoId: varchar("video_id", { length: 32 }),
  videoTitle: text("video_title"),
  videoUrl: text("video_url"),
  postId: integer("post_id").references(() => posts.id, { onDelete: "set null" }),
  postSlug: varchar("post_slug", { length: 255 }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
});

export const socialPosts = pgTable(
  "social_posts",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").references(() => posts.id, { onDelete: "cascade" }),
    platform: socialPlatformEnum("platform").notNull(),
    status: socialPostStatusEnum("status").notNull().default("draft"),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    linkUrl: text("link_url"),
    scheduledAt: timestamp("scheduled_at"),
    publishedAt: timestamp("published_at"),
    externalId: varchar("external_id", { length: 255 }),
    externalUrl: text("external_url"),
    errorMessage: text("error_message"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("social_posts_status_scheduled_idx").on(t.status, t.scheduledAt),
    index("social_posts_post_id_idx").on(t.postId),
  ],
);

export const redirects = pgTable("redirects", {
  id: serial("id").primaryKey(),
  fromPath: varchar("from_path", { length: 1000 }).notNull().unique(),
  toPath: varchar("to_path", { length: 1000 }).notNull(),
  statusCode: integer("status_code").notNull().default(301),
});

// =============================================================================
// AI Kids portal — education domain
// =============================================================================

// Links a parent account to a learner (kid) account. Many-to-many: a parent can
// have several kids; a kid can be linked to two parents.
export const parentChildren = pgTable(
  "parent_children",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    childId: integer("child_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("parent_children_uq").on(t.parentId, t.childId)],
);

// A bookable program / course in the catalog.
export const programs = pgTable(
  "programs",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    category: programCategoryEnum("category").notNull(),
    ageMin: integer("age_min").notNull().default(4),
    ageMax: integer("age_max").notNull().default(16),
    summary: text("summary"), // short card blurb
    description: jsonb("description"), // optional TipTap rich content
    heroImage: text("hero_image"),
    emoji: varchar("emoji", { length: 16 }), // playful icon for cards
    priceCents: integer("price_cents").notNull().default(0),
    published: boolean("published").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("programs_category_idx").on(t.category)],
);

// A scheduled run (cohort) of a program that parents book seats in.
export const classes = pgTable(
  "classes",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    startAt: timestamp("start_at"),
    endAt: timestamp("end_at"),
    schedule: varchar("schedule", { length: 255 }), // e.g. "Sat 10–12, 4 weeks"
    mode: varchar("mode", { length: 16 }).notNull().default("online"), // online | onsite
    location: varchar("location", { length: 255 }),
    maxStudents: integer("max_students").notNull().default(8),
    seatsTaken: integer("seats_taken").notNull().default(0),
    status: classStatusEnum("status").notNull().default("open"),
    priceCents: integer("price_cents").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("classes_program_status_idx").on(t.programId, t.status)],
);

// A parent's booking of a class seat for one of their kids.
export const bookings = pgTable(
  "bookings",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    parentId: integer("parent_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: bookingStatusEnum("status").notNull().default("pending"),
    amountCents: integer("amount_cents").notNull().default(0),
    paymentRef: varchar("payment_ref", { length: 64 }).notNull().unique(),
    paidAt: timestamp("paid_at"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("bookings_class_idx").on(t.classId),
    index("bookings_parent_idx").on(t.parentId),
  ],
);

// Catalog of gamified platform activities a kid can play in their dashboard.
export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 255 }).notNull(),
    category: programCategoryEnum("category").notNull(),
    ageMin: integer("age_min").notNull().default(4),
    ageMax: integer("age_max").notNull().default(16),
    description: text("description"),
    emoji: varchar("emoji", { length: 16 }),
    color: varchar("color", { length: 32 }), // theme accent for the card
    live: boolean("live").notNull().default(false), // working vs "coming soon"
    leaderboardEnabled: boolean("leaderboard_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("activities_category_idx").on(t.category)],
);

// A learner's completion/score of an activity. Drives dashboards + leaderboard.
export const activityCompletions = pgTable(
  "activity_completions",
  {
    id: serial("id").primaryKey(),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    score: integer("score").notNull().default(0),
    metadata: jsonb("metadata"), // e.g. the generated story, phonics round detail
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (t) => [
    index("completions_learner_idx").on(t.learnerId),
    index("completions_activity_idx").on(t.activityId),
  ],
);

// Badge definitions.
export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  emoji: varchar("emoji", { length: 16 }),
});

// Badges earned by learners.
export const learnerAchievements = pgTable(
  "learner_achievements",
  {
    id: serial("id").primaryKey(),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: integer("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("learner_achievements_uq").on(t.learnerId, t.achievementId)],
);

// Images a learner generated in the AI Art Studio (/learn/art).
export const learnerArtworks = pgTable(
  "learner_artworks",
  {
    id: serial("id").primaryKey(),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originalPrompt: text("original_prompt").notNull(), // the child's raw words (for parent review)
    prompt: text("prompt").notNull(), // safety-cleaned prompt sent to Nano Banana
    style: text("style").notNull(), // one of the allowlisted art styles
    r2Url: text("r2_url").notNull(), // generated image stored in R2
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("learner_artworks_learner_idx").on(t.learnerId)],
);

// Branching stories a learner built + saved in the Story Builder (/learn/storytelling).
// `pages` holds the finished path they read: [{ text, image }] — image is an R2
// URL (or an inline data-URL in dev before R2 is configured), or null when a
// page wasn't illustrated.
export const learnerStories = pgTable(
  "learner_stories",
  {
    id: serial("id").primaryKey(),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    pages: jsonb("pages").notNull(), // [{ text: string, image: string | null }]
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("learner_stories_learner_idx").on(t.learnerId)],
);

// Talking Buddy chat log — every turn, kept for cross-session memory AND parent
// review. Children can start a "new chat" (see learnerBuddyMeta) but cannot
// delete these rows.
export const learnerBuddyMessages = pgTable(
  "learner_buddy_messages",
  {
    id: serial("id").primaryKey(),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(), // 'user' | 'buddy'
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("buddy_msg_learner_idx").on(t.learnerId, t.createdAt)],
);

// Per-learner Talking Buddy state. `clearedAt` marks the last "new chat": the
// buddy's context + the child's view only include messages after it, but parent
// review ignores it (shows the full log).
export const learnerBuddyMeta = pgTable("learner_buddy_meta", {
  learnerId: integer("learner_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  clearedAt: timestamp("cleared_at"),
  buddyName: text("buddy_name"), // kid-chosen name for their buddy
  buddyColor: text("buddy_color"), // kid-chosen head colour (hex)
});

// Relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  category: one(categories, {
    fields: [posts.categoryId],
    references: [categories.id],
  }),
  tags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export const pagesRelations = relations(pages, ({ one }) => ({
  author: one(users, { fields: [pages.authorId], references: [users.id] }),
}));

// --- Kids-AI portal relations ---
export const programsRelations = relations(programs, ({ many }) => ({
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  program: one(programs, {
    fields: [classes.programId],
    references: [programs.id],
  }),
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  class: one(classes, { fields: [bookings.classId], references: [classes.id] }),
  parent: one(users, { fields: [bookings.parentId], references: [users.id] }),
  learner: one(users, { fields: [bookings.learnerId], references: [users.id] }),
}));

export const activityCompletionsRelations = relations(
  activityCompletions,
  ({ one }) => ({
    learner: one(users, {
      fields: [activityCompletions.learnerId],
      references: [users.id],
    }),
    activity: one(activities, {
      fields: [activityCompletions.activityId],
      references: [activities.id],
    }),
  }),
);

export const parentChildrenRelations = relations(parentChildren, ({ one }) => ({
  parent: one(users, {
    fields: [parentChildren.parentId],
    references: [users.id],
  }),
  child: one(users, {
    fields: [parentChildren.childId],
    references: [users.id],
  }),
}));

// --- Co-op escape-room sessions (multiplayer) ---
// A shared escape-room game several learners can join with a short code and
// solve together. Progress (which stations are solved + team points) lives on
// the session row; players are tracked for presence + final scoring.
export const escapeSessions = pgTable(
  "escape_sessions",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 12 }).notNull().unique(),
    roomSlug: varchar("room_slug", { length: 255 }).notNull(),
    hostId: integer("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("lobby"), // lobby | playing | escaped
    solved: jsonb("solved").notNull().default([]), // string[] of solved station ids
    points: integer("points").notNull().default(0), // shared team points
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("escape_sessions_code_idx").on(t.code)],
);

export const escapeSessionPlayers = pgTable(
  "escape_session_players",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => escapeSessions.id, { onDelete: "cascade" }),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    avatar: varchar("avatar", { length: 16 }),
    atStation: varchar("at_station", { length: 64 }), // presence: object the kid is at
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("escape_session_players_uq").on(t.sessionId, t.learnerId),
    index("escape_session_players_session_idx").on(t.sessionId),
  ],
);

export const escapeSessionsRelations = relations(escapeSessions, ({ one, many }) => ({
  host: one(users, { fields: [escapeSessions.hostId], references: [users.id] }),
  players: many(escapeSessionPlayers),
}));

export const escapeSessionPlayersRelations = relations(escapeSessionPlayers, ({ one }) => ({
  session: one(escapeSessions, {
    fields: [escapeSessionPlayers.sessionId],
    references: [escapeSessions.id],
  }),
  learner: one(users, {
    fields: [escapeSessionPlayers.learnerId],
    references: [users.id],
  }),
}));

// --- Card-game sessions (memory / discard / math, solo + multiplayer) ---
// A shared card game joined with a short code. The full authoritative game
// state (decks, hands, piles, turn) lives in `state` jsonb; the engine layer
// owns its shape (see src/lib/card-games). Players are tracked for presence +
// scoring, mirroring the escape-room session tables.
export const cardSessions = pgTable(
  "card_sessions",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 12 }).notNull().unique(),
    gameSlug: varchar("game_slug", { length: 64 }).notNull(),
    mode: varchar("mode", { length: 16 }).notNull().default("versus"), // solo | coop | versus
    hostId: integer("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 16 }).notNull().default("lobby"), // lobby | playing | done
    state: jsonb("state"), // engine-owned game state (null until started)
    winners: jsonb("winners").notNull().default([]), // learner ids, best-first
    startedAt: timestamp("started_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("card_sessions_code_idx").on(t.code)],
);

export const cardSessionPlayers = pgTable(
  "card_session_players",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => cardSessions.id, { onDelete: "cascade" }),
    learnerId: integer("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    avatar: varchar("avatar", { length: 16 }),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
    lastSeen: timestamp("last_seen").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("card_session_players_uq").on(t.sessionId, t.learnerId),
    index("card_session_players_session_idx").on(t.sessionId),
  ],
);

export const cardSessionsRelations = relations(cardSessions, ({ one, many }) => ({
  host: one(users, { fields: [cardSessions.hostId], references: [users.id] }),
  players: many(cardSessionPlayers),
}));

export const cardSessionPlayersRelations = relations(cardSessionPlayers, ({ one }) => ({
  session: one(cardSessions, {
    fields: [cardSessionPlayers.sessionId],
    references: [cardSessions.id],
  }),
  learner: one(users, {
    fields: [cardSessionPlayers.learnerId],
    references: [users.id],
  }),
}));
