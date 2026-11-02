"use client";
import { PlayfulText } from "@/components/public/PlaySymbol";


import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ComingSoonPage() {
  const sp = useSearchParams();
  const title = sp.get("title") ?? "This activity";
  const emoji = sp.get("emoji") ?? "✨";
  const slug = sp.get("slug") ?? "";
  const [done, setDone] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  async function tryDemo() {
    // Award a small "explorer" score for trying the sneak peek.
    const demoScore = 10;
    try {
      await fetch("/api/learn/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activitySlug: slug, score: demoScore, metadata: { demo: true } }),
      });
    } catch {
      /* ignore */
    }
    setScore(demoScore);
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-lg">
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
      <div className="mt-3 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
        <div className="text-7xl">{emoji}</div>
        <h1 className="mt-3 font-fun text-3xl font-700 text-slate-900">{title}</h1>
        <p className="mt-2 font-round text-slate-500"><PlayfulText text={" This full activity is coming soon! Our teachers are building something awesome. Try the mini sneak peek to earn a few explorer points. 🌟 "} /></p>
        {!done ? (
          <button
            onClick={tryDemo}
            disabled={!slug}
            className="mt-6 rounded-full bg-grape px-8 py-3 font-fun text-lg font-700 text-white shadow-lg transition hover:scale-105 disabled:opacity-50"
          ><PlayfulText text={" Try the sneak peek 👀 "} /></button>
        ) : (
          <div className="mt-6">
            <div className="inline-block rounded-full bg-mint/20 px-4 py-1 font-fun font-700 text-emerald-600">
              +{score}<PlayfulText text={" explorer points! 🎉 "} /></div>
            <div className="mt-4">
              <Link href="/learn" className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
                Back to activities
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
