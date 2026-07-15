/** Shared read queries for parent + learner dashboards and the leaderboard. */
import { db } from "@/db";
import {
  users,
  parentChildren,
  activities,
  activityCompletions,
  learnerAchievements,
  achievements,
  learnerArtworks,
  learnerStories,
} from "@/db/schema";
import { eq, desc, inArray, sql, and } from "drizzle-orm";

export type Artwork = {
  id: number;
  prompt: string;
  style: string;
  r2Url: string;
  createdAt: Date;
};

/** All pictures a learner has made in the Art Studio, newest first. */
export async function getLearnerArtworks(learnerId: number, style?: string, limit = 60): Promise<Artwork[]> {
  return db
    .select({
      id: learnerArtworks.id,
      prompt: learnerArtworks.prompt,
      style: learnerArtworks.style,
      r2Url: learnerArtworks.r2Url,
      createdAt: learnerArtworks.createdAt,
    })
    .from(learnerArtworks)
    .where(style ? and(eq(learnerArtworks.learnerId, learnerId), eq(learnerArtworks.style, style)) : eq(learnerArtworks.learnerId, learnerId))
    .orderBy(desc(learnerArtworks.createdAt))
    .limit(limit);
}

// `emojis` is the Write-mode illustration fallback, shown when a scene has no
// generated image. Build-mode pages leave it unset.
export type StoryPage = { text: string; image: string | null; emojis?: string | null };
export type SavedStory = {
  id: number;
  title: string;
  pages: StoryPage[];
  createdAt: Date;
};

/** All stories a learner has saved from the Story Builder, newest first. */
export async function getLearnerStories(learnerId: number, limit = 60): Promise<SavedStory[]> {
  const rows = await db
    .select({
      id: learnerStories.id,
      title: learnerStories.title,
      pages: learnerStories.pages,
      createdAt: learnerStories.createdAt,
    })
    .from(learnerStories)
    .where(eq(learnerStories.learnerId, learnerId))
    .orderBy(desc(learnerStories.createdAt))
    .limit(limit);
  return rows as SavedStory[];
}

/** One saved story, only if it belongs to this learner (else null). */
export async function getLearnerStory(learnerId: number, id: number): Promise<SavedStory | null> {
  const [row] = await db
    .select({
      id: learnerStories.id,
      title: learnerStories.title,
      pages: learnerStories.pages,
      createdAt: learnerStories.createdAt,
    })
    .from(learnerStories)
    .where(and(eq(learnerStories.id, id), eq(learnerStories.learnerId, learnerId)))
    .limit(1);
  return (row as SavedStory) ?? null;
}

export type Kid = {
  id: number;
  name: string;
  username: string | null;
  ageGroup: string | null;
  avatar: string | null;
};

export async function getParentChildren(parentId: number): Promise<Kid[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      ageGroup: users.ageGroup,
      avatar: users.avatar,
    })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childId, users.id))
    .where(eq(parentChildren.parentId, parentId));
}

export type LearnerStats = {
  activitiesDone: number;
  totalScore: number;
  badges: number;
};

export async function getLearnerStats(learnerId: number): Promise<LearnerStats> {
  const [agg] = await db
    .select({
      activitiesDone: sql<number>`count(*)::int`,
      totalScore: sql<number>`coalesce(sum(${activityCompletions.score}),0)::int`,
    })
    .from(activityCompletions)
    .where(eq(activityCompletions.learnerId, learnerId));
  const [badgeRow] = await db
    .select({ badges: sql<number>`count(*)::int` })
    .from(learnerAchievements)
    .where(eq(learnerAchievements.learnerId, learnerId));
  return {
    activitiesDone: agg?.activitiesDone ?? 0,
    totalScore: agg?.totalScore ?? 0,
    badges: badgeRow?.badges ?? 0,
  };
}

export type RecentCompletion = {
  id: number;
  score: number;
  completedAt: Date;
  activityTitle: string;
  activityEmoji: string | null;
};

export async function getRecentCompletions(
  learnerId: number,
  limit = 10,
): Promise<RecentCompletion[]> {
  return db
    .select({
      id: activityCompletions.id,
      score: activityCompletions.score,
      completedAt: activityCompletions.completedAt,
      activityTitle: activities.title,
      activityEmoji: activities.emoji,
    })
    .from(activityCompletions)
    .innerJoin(activities, eq(activityCompletions.activityId, activities.id))
    .where(eq(activityCompletions.learnerId, learnerId))
    .orderBy(desc(activityCompletions.completedAt))
    .limit(limit);
}

export async function getLearnerBadges(learnerId: number) {
  return db
    .select({
      title: achievements.title,
      emoji: achievements.emoji,
      description: achievements.description,
      awardedAt: learnerAchievements.awardedAt,
    })
    .from(learnerAchievements)
    .innerJoin(achievements, eq(learnerAchievements.achievementId, achievements.id))
    .where(eq(learnerAchievements.learnerId, learnerId));
}

/** Leaderboard for one activity (only if leaderboard is enabled). Top N by score. */
export async function getActivityLeaderboard(activityId: number, limit = 20) {
  return db
    .select({
      learnerId: activityCompletions.learnerId,
      name: users.name,
      avatar: users.avatar,
      best: sql<number>`max(${activityCompletions.score})::int`,
      plays: sql<number>`count(*)::int`,
    })
    .from(activityCompletions)
    .innerJoin(users, eq(activityCompletions.learnerId, users.id))
    .where(eq(activityCompletions.activityId, activityId))
    .groupBy(activityCompletions.learnerId, users.name, users.avatar)
    .orderBy(desc(sql`max(${activityCompletions.score})`))
    .limit(limit);
}

/** Global leaderboard across all leaderboard-enabled activities. */
export async function getGlobalLeaderboard(limit = 20) {
  const enabled = await db
    .select({ id: activities.id })
    .from(activities)
    .where(eq(activities.leaderboardEnabled, true));
  const ids = enabled.map((a) => a.id);
  if (ids.length === 0) return [];
  return db
    .select({
      learnerId: activityCompletions.learnerId,
      name: users.name,
      avatar: users.avatar,
      total: sql<number>`coalesce(sum(${activityCompletions.score}),0)::int`,
    })
    .from(activityCompletions)
    .innerJoin(users, eq(activityCompletions.learnerId, users.id))
    .where(inArray(activityCompletions.activityId, ids))
    .groupBy(activityCompletions.learnerId, users.name, users.avatar)
    .orderBy(desc(sql`coalesce(sum(${activityCompletions.score}),0)`))
    .limit(limit);
}
