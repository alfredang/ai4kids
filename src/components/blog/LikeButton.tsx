"use client";

import { useEffect, useState } from "react";
import { KidsIcon } from "@/components/public/KidsIcon";

export function LikeButton({
  slug,
  initialCount,
}: {
  slug: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const flag = localStorage.getItem(`blog-liked:${slug}`) === "1";
    if (flag && initialCount <= 0) {
      localStorage.removeItem(`blog-liked:${slug}`);
      setLiked(false);
    } else {
      setLiked(flag);
    }
  }, [slug, initialCount]);

  async function onClick() {
    if (pending) return;
    setPending(true);
    const nextLiked = !liked;
    const action = nextLiked ? "like" : "unlike";
    setLiked(nextLiked);
    setCount((c) => (nextLiked ? c + 1 : Math.max(0, c - 1)));
    if (nextLiked) {
      localStorage.setItem(`blog-liked:${slug}`, "1");
    } else {
      localStorage.removeItem(`blog-liked:${slug}`);
    }
    try {
      const res = await fetch("/api/blog/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action }),
      });
      if (res.ok) {
        const data = (await res.json()) as { likeCount?: number };
        if (typeof data.likeCount === "number") setCount(data.likeCount);
      } else {
        setLiked(!nextLiked);
        setCount((c) => (nextLiked ? Math.max(0, c - 1) : c + 1));
        if (nextLiked) {
          localStorage.removeItem(`blog-liked:${slug}`);
        } else {
          localStorage.setItem(`blog-liked:${slug}`, "1");
        }
      }
    } catch {
      setLiked(!nextLiked);
      setCount((c) => (nextLiked ? Math.max(0, c - 1) : c + 1));
      if (nextLiked) {
        localStorage.removeItem(`blog-liked:${slug}`);
      } else {
        localStorage.setItem(`blog-liked:${slug}`, "1");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "Unlike this post" : "Like this post"}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
        liked
          ? "bg-(--color-cyan)/15 border-(--color-cyan)/40 text-(--color-cyan)"
          : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-(--color-cyan) hover:border-(--color-cyan)/30"
      } disabled:opacity-60`}
    >
      <KidsIcon name="heart" className={`w-4 h-4 ${liked ? "" : "opacity-80"}`} />
      <span className="tabular-nums">{count}</span>
      <span className="hidden sm:inline">{liked ? "Liked" : "Like"}</span>
    </button>
  );
}
