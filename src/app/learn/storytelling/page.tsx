"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useReadAloud } from "@/lib/use-read-aloud";
import {
  HEROES,
  PLACES,
  OBJECTS,
  MOODS,
  buildStory,
  type Choice,
  type Branch,
  type Story as BranchStory,
} from "@/lib/story-builder/templates";

/**
 * Story — one activity, two ways to make a story:
 *  • Build  — pick a hero/place/item/mood and read a branching, illustrated tale.
 *  • Write  — type your own idea and get a 3-scene illustrated story.
 * (Merges the former AI Storytelling + Story Builder activities.)
 */
type Mode = null | "build" | "write";

export default function StoryPage() {
  const [mode, setMode] = useState<Mode>(null);
  if (mode === "build") return <BuildMode onBack={() => setMode(null)} />;
  if (mode === "write") return <WriteMode onBack={() => setMode(null)} />;
  return <StartScreen onPick={setMode} />;
}

/* ============================ Start screen ============================ */

function StartScreen({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
        ← Back to activities
      </Link>
      <div className="mt-3 rounded-[2rem] bg-gradient-to-r from-coral/20 via-cream to-grape/20 p-6">
        <h1 className="font-fun text-3xl font-700 text-slate-900">📖 Story Time</h1>
        <p className="mt-1 font-round font-600 text-slate-600">How do you want to make your story?</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => onPick("build")}
          className="flex flex-col items-start gap-2 rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-grape/30 transition hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-grape/15 text-3xl">🪄</div>
          <div className="font-fun text-xl font-700 text-slate-900">Build a story</div>
          <p className="font-round text-sm text-slate-500">Pick a hero, place, and magic item — then choose how the tale ends.</p>
        </button>

        <button
          onClick={() => onPick("write")}
          className="flex flex-col items-start gap-2 rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-coral/30 transition hover:-translate-y-1 hover:shadow-md"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-coral/15 text-3xl">✍️</div>
          <div className="font-fun text-xl font-700 text-slate-900">Write your own</div>
          <p className="font-round text-sm text-slate-500">Type any idea and watch the AI turn it into an illustrated story.</p>
        </button>
      </div>
    </div>
  );
}

/* ============================ Write mode ============================ */

type SceneStory = { title: string; scenes: { text: string; emojis: string; image?: string }[] };

const IDEAS = [
  "a dragon who is afraid of fire",
  "a robot learning to paint",
  "a cat astronaut on the moon",
  "a magical treehouse",
];

function WriteMode({ onBack }: { onBack: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState<SceneStory | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { speak } = useReadAloud();

  // Keep the finished tale in "My Stories" so the child can read it again.
  async function saveStory() {
    if (!story || saving || saved) return;
    setSaving(true);
    try {
      const res = await fetch("/api/learn/story/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: story.title.slice(0, 200),
          pages: story.scenes.map((s) => ({ text: s.text, image: s.image ?? null, emojis: s.emojis ?? null })),
        }),
      });
      if (res.ok) setSaved(true);
    } catch {
      /* keep the button active so the child can retry */
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setStory(null);
    setScore(null);
    setSaved(false);
    try {
      const res = await fetch("/api/learn/storytelling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStory(data.story);
      setScore(data.score);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oops, try again!");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={onBack} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
        ← Choose a different way
      </button>
      <div className="mt-3 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-coral/30">
        <h1 className="font-fun text-3xl font-700 text-slate-900">✍️ Write your own</h1>
        <p className="mt-1 font-round text-slate-500">Tell the AI what your story is about and watch it come to life!</p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="My story is about…"
          className="mt-4 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {IDEAS.map((i) => (
            <button
              key={i}
              onClick={() => setPrompt(i)}
              className="rounded-full bg-amber-50 px-3 py-1 text-sm font-600 text-slate-500 ring-1 ring-amber-100 hover:bg-amber-100"
            >
              ✨ {i}
            </button>
          ))}
        </div>
        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="mt-4 rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-105 disabled:opacity-60"
        >
          {loading ? "Dreaming up your story… ✨" : "Make my story! 🪄"}
        </button>
        {error && <p className="mt-3 text-coral">{error}</p>}
      </div>

      {story && (
        <div className="mt-6 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-amber-100">
          {score != null && (
            <div className="mb-4 inline-block rounded-full bg-mint/20 px-4 py-1 font-fun font-700 text-emerald-600">
              +{score} points earned! 🎉
            </div>
          )}
          <h2 className="font-fun text-2xl font-700 text-slate-900">{story.title}</h2>
          <div className="mt-4 space-y-5">
            {story.scenes.map((s, i) => (
              <div key={i} className="rounded-2xl bg-gradient-to-r from-amber-50 to-white p-5 ring-1 ring-amber-100">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt={s.text} className="w-full rounded-xl ring-1 ring-amber-100" />
                ) : (
                  <div className="text-5xl">{s.emojis}</div>
                )}
                <p className="mt-2 font-round text-lg text-slate-700">{s.text}</p>
                <button
                  onClick={() => speak(s.text)}
                  className="mt-2 rounded-full bg-amber-100 px-3 py-1 font-fun text-sm font-700 text-amber-700 transition hover:bg-amber-200"
                >
                  🔊 Read to me
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {saved ? (
              <Link href="/learn/stories" className="rounded-full bg-mint/30 px-6 py-3 font-fun font-700 text-emerald-700 shadow">
                Saved! View My Stories 📚
              </Link>
            ) : (
              <button
                onClick={saveStory}
                disabled={saving}
                className="rounded-full bg-grape px-6 py-3 font-fun font-700 text-white shadow disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save my story 📖"}
              </button>
            )}
            <button
              onClick={() => {
                setStory(null);
                setPrompt("");
                setSaved(false);
              }}
              className="rounded-full bg-sky-500 px-6 py-3 font-fun font-700 text-white shadow"
            >
              Write another! ✏️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Build mode ============================ */

const randIndex = (n: number) => Math.floor(Math.random() * n);

/** A node that can pose a fork — the story root, or any branch with a follow-up. */
type ForkNode = { problem?: string; choiceA?: Branch; choiceB?: Branch };

/**
 * Flatten the story along the path chosen so far. The tale forks up to twice, so
 * the page list grows as the child decides: `forks[k]` is the page index of the
 * k-th fork, and it's answered by `chosen[k]`. The first unanswered fork is
 * therefore `forks[chosen.length]` — that's where the child is deciding now.
 */
function buildTimeline(story: BranchStory, chosen: Branch[]): { pages: string[]; forks: number[] } {
  const pages = [...story.pre, story.problem];
  const forks = [story.pre.length];
  for (const b of chosen) {
    pages.push(...b.pages);
    if (b.problem && b.choiceA && b.choiceB) {
      pages.push(b.problem);
      forks.push(pages.length - 1);
    }
  }
  return { pages, forks };
}

/** Pages still to come if the child keeps picking A — used only to show a total.
 *  Both branches are the same length in generated stories; an AI story may differ
 *  slightly, so this is an estimate (as the single-fork version was too). */
function remainingFrom(node: ForkNode | null): number {
  const b = node?.choiceA;
  if (!b) return 0;
  return b.pages.length + (b.problem && b.choiceA && b.choiceB ? 1 + remainingFrom(b) : 0);
}

function BuildMode({ onBack }: { onBack: () => void }) {
  const [hero, setHero] = useState<number | null>(null);
  const [place, setPlace] = useState<number | null>(null);
  const [obj, setObj] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);

  const [story, setStory] = useState<BranchStory | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  // The branches picked so far — one per resolved fork. Replaces a `picked`
  // boolean, which couldn't express a path once the story forks twice.
  const [chosen, setChosen] = useState<Branch[]>([]);
  const [generating, setGenerating] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [awarded, setAwarded] = useState(false); // did *this* finish grant points, or is it a replay?
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Illustrations are cached by page *text* (not index) so a page prefetched at
  // the fork — before we know which branch is chosen — is reused on arrival.
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [seed, setSeed] = useState(0);
  const requested = useRef<Set<string>>(new Set());
  const scored = useRef(false); // award the finish bonus once, even if the child replays the other ending

  const { speak, prefetch, stop } = useReadAloud();
  const [autoRead, setAutoRead] = useState(false);

  const ready = hero != null && place != null && obj != null && mood != null;
  const heroC = hero != null ? HEROES[hero] : null;
  const placeC = place != null ? PLACES[place] : null;
  const objC = obj != null ? OBJECTS[obj] : null;
  // Repeated on every illustration so the hero looks the same page to page.
  const characterAnchor = heroC && mood != null ? `a ${MOODS[mood].name} ${heroC.name} ${heroC.emoji}` : undefined;

  const { pages, forks } = useMemo(
    () => (story ? buildTimeline(story, chosen) : { pages: [] as string[], forks: [] as number[] }),
    [story, chosen],
  );
  const isFork = useCallback((i: number) => forks.includes(i), [forks]);
  // The node whose fork is unanswered: the root until a pick, then the last branch.
  const pendingNode: ForkNode | null = story ? (chosen.length === 0 ? story : chosen[chosen.length - 1]) : null;
  const optionA = pendingNode?.choiceA;
  const optionB = pendingNode?.choiceB;
  const atChoice = pageIndex === forks[chosen.length] && !!optionA && !!optionB;
  const pageCount = story ? pages.length + remainingFrom(atChoice ? pendingNode : null) : 0;

  function restart() {
    stop();
    setStory(null);
    setPageIndex(0);
    setChosen([]);
    setCelebrate(false);
    setImages({});
    requested.current = new Set();
    setHero(null);
    setPlace(null);
    setObj(null);
    setMood(null);
  }

  function showStory(s: BranchStory) {
    setStory(s);
    setPageIndex(0);
    setChosen([]);
    setImages({});
    requested.current = new Set();
    scored.current = false;
    setSaved(false);
    setSeed(Math.floor(Math.random() * 1_000_000)); // pins the character look for this story
  }

  const makeStory = useCallback(async (h: number, p: number, o: number, m: number) => {
    setGenerating(true);
    try {
      const res = await fetch("/api/learn/story-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hero: h, place: p, object: o, mood: m }),
      });
      const d = await res.json();
      if (d.story) showStory(d.story as BranchStory);
      else showStory(buildStory(HEROES[h], PLACES[p], OBJECTS[o], MOODS[m]));
    } catch {
      showStory(buildStory(HEROES[h], PLACES[p], OBJECTS[o], MOODS[m]));
    } finally {
      setGenerating(false);
    }
  }, []);

  function surprise() {
    const h = randIndex(HEROES.length);
    const p = randIndex(PLACES.length);
    const o = randIndex(OBJECTS.length);
    const m = randIndex(MOODS.length);
    setHero(h);
    setPlace(p);
    setObj(o);
    setMood(m);
    makeStory(h, p, o, m);
  }

  function choose(useA: boolean) {
    const branch = useA ? optionA : optionB;
    if (!branch) return;
    stop();
    setChosen((c) => [...c, branch]); // pages re-derive; the next page is the branch's first
    setPageIndex((i) => i + 1);
  }

  function nextPage() {
    if (pageIndex < pages.length - 1) {
      setPageIndex((i) => i + 1);
    } else {
      stop();
      const first = !scored.current;
      if (first) {
        scored.current = true;
        fetch("/api/learn/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activitySlug: "ai-storytelling", score: 60, metadata: { mode: "build", pages: pages.length } }),
        }).catch(() => {});
      }
      setAwarded(first);
      setCelebrate(true);
    }
  }

  // Rewind one decision so the child can try the branch they didn't pick. The
  // story + illustrations are cached (images are keyed by text), so it's instant.
  function replayFork() {
    if (!story || chosen.length === 0) return;
    stop();
    setSaved(false); // the other ending is a new tale the child can save too
    setCelebrate(false);
    const next = chosen.slice(0, -1);
    setChosen(next);
    setPageIndex(buildTimeline(story, next).forks[next.length]);
  }

  // Save the finished story (title + each page's text and cached illustration)
  // to the learner's "My Stories" gallery so they can read it again later.
  async function saveStory() {
    if (saving || saved) return;
    setSaving(true);
    const title = heroC && mood != null ? `A ${MOODS[mood].name} ${heroC.name} ${heroC.emoji} Adventure` : "My Story";
    const payload = { title, pages: pages.map((text) => ({ text, image: images[text] ?? null })) };
    try {
      const res = await fetch("/api/learn/story/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) setSaved(true);
    } catch {
      /* keep the button active so the child can retry */
    } finally {
      setSaving(false);
    }
  }

  // Illustrate a page by its text, once. Every call carries the same character
  // anchor + seed so the hero stays visually consistent across the whole story.
  const fetchImageFor = useCallback(
    (text: string | undefined) => {
      if (!text || requested.current.has(text)) return;
      requested.current.add(text);
      fetch("/api/learn/story-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, characterAnchor, seed }),
      })
        .then((r) => r.json())
        .then((d) => setImages((m) => ({ ...m, [text]: (d.url as string | null) ?? null })))
        .catch(() => setImages((m) => ({ ...m, [text]: null })));
    },
    [characterAnchor, seed],
  );

  // Fetch the current page and prefetch what comes next so the picture is ready
  // before the child taps through. Fork/problem pages stay illustration-free; at
  // a fork we prefetch BOTH branches' first page so either pick feels instant.
  useEffect(() => {
    if (pages.length === 0) return;
    if (!isFork(pageIndex)) fetchImageFor(pages[pageIndex]);
    if (!isFork(pageIndex + 1)) fetchImageFor(pages[pageIndex + 1]);
    if (atChoice) {
      fetchImageFor(optionA?.pages[0]);
      fetchImageFor(optionB?.pages[0]);
    }
  }, [pageIndex, pages, atChoice, optionA, optionB, isFork, fetchImageFor]);

  // Auto-narrate each new page once "read to me" is on (fork pages stay silent).
  useEffect(() => {
    if (!autoRead || pages.length === 0 || isFork(pageIndex) || celebrate) return;
    speak(pages[pageIndex]);
  }, [pageIndex, pages, autoRead, isFork, celebrate, speak]);

  // Narration takes ~1.5-2s to generate, so warm the next page's audio while the
  // child is still on this one — the same trick as the illustration prefetch.
  useEffect(() => {
    if (!autoRead || pages.length === 0) return;
    if (!isFork(pageIndex + 1)) prefetch(pages[pageIndex + 1]);
    if (atChoice) {
      prefetch(optionA?.pages[0]);
      prefetch(optionB?.pages[0]);
    }
  }, [autoRead, pageIndex, pages, atChoice, optionA, optionB, isFork, prefetch]);

  const currentText = pages[pageIndex];
  const img = currentText != null ? images[currentText] : undefined;
  // Fork pages are never fetched, so they must not show the loading pulse.
  const imgBusy = currentText != null && !isFork(pageIndex) && !(currentText in images);

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={onBack} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
        ← Choose a different way
      </button>

      {generating ? (
        <div className="mt-3 flex min-h-[24rem] flex-col items-center justify-center gap-4 rounded-[2rem] bg-white p-8 text-center shadow-sm ring-1 ring-grape/30">
          <div className="animate-pulse text-6xl">✨📖✨</div>
          <p className="font-fun text-xl font-700 text-slate-800">Writing your story…</p>
        </div>
      ) : pages.length === 0 ? (
        <div className="mt-3 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-grape/30">
          <h1 className="font-fun text-3xl font-700 text-slate-900">🪄 Build a story</h1>
          <p className="mt-1 font-round font-600 text-slate-500">Pick your ingredients and I&apos;ll weave a story!</p>

          <ChoiceRow title="Pick your hero" items={HEROES} selected={hero} onSelect={setHero} />
          <ChoiceRow title="Pick a place" items={PLACES} selected={place} onSelect={setPlace} />
          <ChoiceRow title="Pick a magic item" items={OBJECTS} selected={obj} onSelect={setObj} />
          <ChoiceRow title="Pick a mood" items={MOODS} selected={mood} onSelect={setMood} />

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={() => ready && makeStory(hero!, place!, obj!, mood!)}
              disabled={!ready}
              className="w-full rounded-full bg-coral py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-[1.02] disabled:opacity-40"
            >
              ✨ Make my story!
            </button>
            <button onClick={surprise} className="w-full rounded-full bg-grape py-3 font-fun font-700 text-white shadow transition hover:scale-[1.02]">
              🎲 Surprise me!
            </button>
          </div>
        </div>
      ) : celebrate ? (
        <div className="mt-3 rounded-[2rem] bg-white p-10 text-center shadow-sm ring-1 ring-amber-100">
          <div className="text-7xl">{awarded ? "🎉" : "🌈"}</div>
          <h2 className="mt-3 font-fun text-3xl font-700 text-slate-900">
            {awarded ? "What a story! ⭐⭐⭐" : "Another great ending!"}
          </h2>
          <p className="mt-1 font-round text-slate-500">
            {awarded ? "You earned +60 points!" : "You explored the other path — nice work! 🌟"}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={replayFork} className="rounded-full bg-grape px-6 py-3 font-fun font-700 text-white shadow">
              Try the other path 🔀
            </button>
            {saved ? (
              <Link href="/learn/stories" className="rounded-full bg-mint/30 px-6 py-3 font-fun font-700 text-emerald-700 shadow">
                Saved! View My Stories 📚
              </Link>
            ) : (
              <button
                onClick={saveStory}
                disabled={saving}
                className="rounded-full bg-sky-500 px-6 py-3 font-fun font-700 text-white shadow disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save my storybook 📖"}
              </button>
            )}
            <button onClick={restart} className="rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow">
              Build another 🔁
            </button>
            <Link href="/learn" className="rounded-full bg-slate-100 px-6 py-3 font-fun font-600 text-slate-600">
              All activities
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-5 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-grape/30">
          <div className="flex min-h-[9rem] w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 to-white ring-1 ring-amber-100">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={pages[pageIndex]} className="max-h-72 max-w-full w-auto object-contain" />
            ) : (
              <div className={`py-6 text-6xl ${imgBusy && !atChoice ? "animate-pulse" : ""}`}>
                {heroC?.emoji}
                {placeC?.emoji}
                {objC?.emoji}
              </div>
            )}
          </div>

          <p className="min-h-[5rem] whitespace-pre-line text-center font-round text-xl font-600 text-slate-700">{pages[pageIndex]}</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => speak(pages[pageIndex])}
              className="rounded-full bg-amber-100 px-4 py-1.5 font-fun text-sm font-700 text-amber-700 transition hover:bg-amber-200"
            >
              🔊 Read to me
            </button>
            <button
              onClick={() => setAutoRead((v) => !v)}
              className={`rounded-full px-4 py-1.5 font-fun text-sm font-700 transition ${
                autoRead ? "bg-mint/30 text-emerald-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {autoRead ? "🔁 Auto-read on" : "Auto-read off"}
            </button>
          </div>

          {atChoice && optionA && optionB ? (
            <div className="flex w-full flex-col gap-3">
              <button onClick={() => choose(true)} className="w-full rounded-full bg-grape py-3 font-fun font-700 text-white shadow transition hover:scale-[1.02]">
                {optionA.emoji} {optionA.label}
              </button>
              <button onClick={() => choose(false)} className="w-full rounded-full bg-sky-500 py-3 font-fun font-700 text-white shadow transition hover:scale-[1.02]">
                {optionB.emoji} {optionB.label}
              </button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <span className="font-round text-sm font-600 text-slate-400">
                Page {pageIndex + 1} of {pageCount}
              </span>
              <button onClick={nextPage} className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105">
                {pageIndex === pages.length - 1 ? "The End! 🎉" : "Next ▶"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChoiceRow({ title, items, selected, onSelect }: { title: string; items: Choice[]; selected: number | null; onSelect: (i: number) => void }) {
  return (
    <div className="mt-5">
      <p className="font-fun font-700 text-slate-800">{title}</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {items.map((item, i) => {
          const on = selected === i;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className={`flex flex-col items-center gap-1 rounded-2xl p-3 ring-1 transition ${
                on ? "scale-[1.03] bg-coral/15 ring-2 ring-coral/50" : "bg-white ring-slate-100 hover:bg-amber-50"
              }`}
            >
              <span className="text-3xl">{item.emoji}</span>
              <span className="font-fun text-xs font-700 text-slate-600">{item.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
