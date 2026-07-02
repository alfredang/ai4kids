import bcrypt from "bcryptjs";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "../src/db";
import {
  users,
  parentChildren,
  programs,
  classes,
  activities,
  achievements,
  settings,
} from "../src/db/schema";
import { ESCAPE_ROOMS } from "../src/lib/escape-rooms";
import { CARD_GAMES } from "../src/lib/card-games/meta";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function upsertUserByEmail(email: string, values: typeof users.$inferInsert) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [u] = await db.insert(users).values(values).returning();
  return u;
}

async function upsertUserByUsername(username: string, values: typeof users.$inferInsert) {
  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) return existing;
  const [u] = await db.insert(users).values(values).returning();
  return u;
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@aikids.local";
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe-2026!";

  // --- Admin ---
  const admin = await upsertUserByEmail(adminEmail, {
    email: adminEmail,
    passwordHash: await bcrypt.hash(adminPassword, 10),
    name: "Academy Admin",
    role: "admin",
  });
  console.log(`Admin: ${admin.email} (id=${admin.id})`);

  // --- Demo parent (password-enabled so it's testable without Google) ---
  const parent = await upsertUserByEmail("parent.demo@aikids.local", {
    email: "parent.demo@aikids.local",
    passwordHash: await bcrypt.hash("parent123", 10),
    name: "Jamie Tan",
    role: "parent",
    avatar: "👩",
  });
  console.log(`Parent: ${parent.email} (id=${parent.id}) — password: parent123`);

  // --- Demo kids ---
  const kidsSeed = [
    { name: "Maya Tan", username: "maya-star", age: "7-9", avatar: "👧" },
    { name: "Ethan Tan", username: "ethan-rocket", age: "10-12", avatar: "👦" },
    { name: "Tony Tan", username: "tony-tiger", age: "8-10", avatar: "👦" },
  ];
  const kidIds: number[] = [];
  for (const k of kidsSeed) {
    const kid = await upsertUserByUsername(k.username, {
      username: k.username,
      passwordHash: await bcrypt.hash("play123", 10),
      name: k.name,
      role: "learner",
      ageGroup: k.age,
      avatar: k.avatar,
    });
    kidIds.push(kid.id);
    await db
      .insert(parentChildren)
      .values({ parentId: parent.id, childId: kid.id })
      .onConflictDoNothing();
    console.log(`Kid: @${k.username} (id=${kid.id}) — password: play123`);
  }

  // --- Programs (one per category) ---
  const programSeed = [
    { title: "Story Magic with AI", category: "storytelling", emoji: "📖", ageMin: 6, ageMax: 10, price: 280, summary: "Write & illustrate your own AI storybooks." },
    { title: "AI Art Studio", category: "art", emoji: "🎨", ageMin: 5, ageMax: 12, price: 260, summary: "Turn your ideas into pictures with AI in any style." },
    { title: "Junior Code Lab", category: "coding", emoji: "💻", ageMin: 8, ageMax: 12, price: 320, summary: "Build apps and websites with an AI coding buddy." },
    { title: "AI Game Studio", category: "game-dev", emoji: "🎮", ageMin: 10, ageMax: 14, price: 340, summary: "Design, code and play your own games." },
    { title: "Phonics Playground", category: "phonics", emoji: "🔤", ageMin: 4, ageMax: 7, price: 220, summary: "Letters, sounds and first words with playful AI games." },
    { title: "Escape the AI Lab", category: "escape-room", emoji: "🗝️", ageMin: 9, ageMax: 14, price: 300, summary: "Crack codes and solve AI puzzles to escape." },
    { title: "Brain Arcade", category: "free-games", emoji: "🕹️", ageMin: 4, ageMax: 16, price: 0, summary: "Free brain games for every age." },
  ] as const;

  const programIds: Record<string, number> = {};
  for (let i = 0; i < programSeed.length; i++) {
    const p = programSeed[i];
    const [existing] = await db.select().from(programs).where(eq(programs.slug, slug(p.title))).limit(1);
    if (existing) {
      programIds[p.category] = existing.id;
      continue;
    }
    const [created] = await db
      .insert(programs)
      .values({
        title: p.title,
        slug: slug(p.title),
        category: p.category,
        emoji: p.emoji,
        ageMin: p.ageMin,
        ageMax: p.ageMax,
        summary: p.summary,
        priceCents: p.price * 100,
        published: true,
        sortOrder: i,
      })
      .returning();
    programIds[p.category] = created.id;
  }
  console.log(`Programs: ${Object.keys(programIds).length}`);

  // --- Classes (incl. a tiny one to demo auto-close) ---
  const classSeed = [
    { cat: "storytelling", title: "Story Magic — Sat AM cohort", schedule: "Sat 10–12, 4 weeks", max: 8, price: 280 },
    { cat: "coding", title: "Junior Code Lab — Sun PM cohort", schedule: "Sun 2–4, 6 weeks", max: 6, price: 320 },
    { cat: "phonics", title: "Phonics Playground — Wed cohort", schedule: "Wed 4–5, 8 weeks", max: 10, price: 220 },
    { cat: "escape-room", title: "Escape the AI Lab — Holiday camp (2 seats!)", schedule: "Jun holiday, 2 days", max: 2, price: 300 },
  ] as const;
  for (const c of classSeed) {
    const pid = programIds[c.cat];
    if (!pid) continue;
    const [exists] = await db.select().from(classes).where(eq(classes.title, c.title)).limit(1);
    if (exists) continue;
    await db.insert(classes).values({
      programId: pid,
      title: c.title,
      schedule: c.schedule,
      mode: "online",
      maxStudents: c.max,
      priceCents: c.price * 100,
      status: "open",
    });
  }
  console.log(`Classes: ${classSeed.length}`);

  // Remove any escape-room activities that are no longer in the catalog
  // (the old single placeholder, or rooms that have been re-themed/renamed).
  await db
    .delete(activities)
    .where(
      and(
        eq(activities.category, "escape-room"),
        notInArray(activities.slug, ESCAPE_ROOMS.map((r) => r.activitySlug)),
      ),
    );

  // --- Activities ---
  const activitySeed = [
    { slug: "ai-storytelling", title: "Story Time", category: "storytelling", emoji: "📖", live: true, desc: "Build a branching tale or write your own — illustrated by AI." },
    { slug: "ai-art", title: "AI Art Studio", category: "art", emoji: "🎨", live: true, desc: "Turn your ideas into pictures with AI." },
    { slug: "ai-phonics", title: "Phonics Quest", category: "phonics", emoji: "🔤", live: true, desc: "Travel the worlds and master every sound!" },
    { slug: "ai-coding", title: "AI Code Quest", category: "coding", emoji: "💻", live: false, desc: "Build with code blocks (coming soon)." },
    { slug: "ai-game-dev", title: "AI Game Maker", category: "game-dev", emoji: "🎮", live: false, desc: "Make your own game (coming soon)." },
    { slug: "ai-jigsaw", title: "AI Jigsaw", category: "art", emoji: "🧩", live: true, desc: "Turn your art into a puzzle!" },
    { slug: "ai-buddy", title:"Talking Buddy", category: "storytelling", emoji: "🤖", live: true, desc: "Chat with an AI friend!" },

    // Sample AI Escape Rooms — one activity per playable room (see src/lib/escape-rooms.ts).
    ...ESCAPE_ROOMS.map((r) => ({
      slug: r.activitySlug,
      title: r.title,
      category: "escape-room" as const,
      emoji: r.emoji,
      live: true,
      desc: r.tagline,
    })),
    // Card games — one activity per game (see src/lib/card-games/meta.ts).
    ...CARD_GAMES.map((g) => ({
      slug: g.activitySlug,
      title: g.title,
      category: "free-games" as const,
      emoji: g.emoji,
      live: true,
      desc: g.tagline,
    })),
  ];
  for (let i = 0; i < activitySeed.length; i++) {
    const a = activitySeed[i];
    const [exists] = await db.select().from(activities).where(eq(activities.slug, a.slug)).limit(1);
    if (exists) continue;
    await db.insert(activities).values({
      slug: a.slug,
      title: a.title,
      category: a.category as (typeof activities.$inferInsert)["category"],
      emoji: a.emoji,
      description: a.desc,
      live: a.live,
      leaderboardEnabled: true,
      sortOrder: i,
    });
  }
  console.log(`Activities: ${activitySeed.length}`);

  // --- Achievements ---
  const badgeSeed = [
    { slug: "first-steps", title: "First Steps", emoji: "👟", description: "Completed your first activity!" },
    { slug: "storyteller", title: "Storyteller", emoji: "📚", description: "Wrote an AI story." },
    { slug: "word-wizard", title: "Word Wizard", emoji: "🪄", description: "Played AI Phonics." },
  ];
  for (const b of badgeSeed) {
    await db.insert(achievements).values(b).onConflictDoNothing();
  }
  console.log(`Achievements: ${badgeSeed.length}`);

  // --- Portal settings ---
  const settingsSeed: Record<string, string> = {
    paynow_uen: process.env.PAYNOW_UEN || "201200696W",
    paynow_payee_name: process.env.PAYNOW_PAYEE_NAME || "AI Kids Academy",
    whatsapp_number: process.env.WHATSAPP_NUMBER || "6588666375",
    site_title: "AI Kids Academy",
    company_short_name: "AI Kids Academy",
    company_name: "AI Kids Academy Pte Ltd",
    tagline: "Fun AI learning for ages 4-16",
  };
  for (const [key, value] of Object.entries(settingsSeed)) {
    await db
      .insert(settings)
      .values({ key, value: value as unknown as object })
      .onConflictDoUpdate({ target: settings.key, set: { value: value as unknown as object } });
  }
  console.log("Portal settings seeded.");

  console.log("\n✅ Seed complete.");
  console.log(`   Admin login (/admin/login): ${adminEmail} / ${adminPassword}`);
  console.log(`   Parent login (/login → Parent tab uses Google; or test via Kid tab with email): parent.demo@aikids.local / parent123`);
  console.log(`   Kid logins (/login → Kid tab): maya-star / play123 , ethan-rocket / play123`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
