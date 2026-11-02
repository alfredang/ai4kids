"use client";
import { PlayfulText } from "@/components/public/PlaySymbol";


import { useState } from "react";
import Link from "next/link";
import { JigsawBoard } from "@/components/portal/JigsawBoard";

const IDEAS = [
  "a friendly dragon having a picnic",
  "a cat astronaut on the moon",
  "a robot painting a rainbow",
  "a magical underwater castle",
];

const STYLES: { key: string; label: string; emoji: string }[] = [
  { key: "cartoon", label: "Cartoon", emoji: "✏️" },
  { key: "watercolor", label: "Watercolour", emoji: "🎨" },
  { key: "pixel", label: "Pixel", emoji: "👾" },
  { key: "crayon", label: "Crayon", emoji: "🖍️" },
  { key: "scifi", label: "Sci-Fi", emoji: "🚀" },
];

export default function ArtStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("cartoon");
  const [loading, setLoading] = useState(false);
  const [imageURL, setImageURL] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setNotice("");
    setImageURL(null);
    setScore(null);
    setPlaying(false);
    try {
      const res = await fetch("/api/learn/art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (data.blocked || data.placeholder) {
        setNotice(data.message);
      } else {
        setImageURL(data.imageUrl);
        setScore(data.score);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Oops, try again!");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">← Back to activities</Link>
      <div className="mt-3 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-tangerine/30">
        <h1 className="font-fun text-3xl font-700 text-slate-900"><PlayfulText text={"🎨 AI Art Studio"} /></h1>
        <p className="mt-1 font-round text-slate-500">Describe a picture and the AI will paint it for you!</p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          maxLength={200}
          placeholder="I want a picture of…"
          className="mt-4 w-full rounded-2xl border-2 border-orange-100 bg-orange-50/40 px-4 py-3 font-round text-lg outline-none focus:border-tangerine"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {IDEAS.map((i) => (
            <button
              key={i}
              onClick={() => setPrompt(i)}
              className="rounded-full bg-orange-50 px-3 py-1 text-sm font-600 text-slate-500 ring-1 ring-orange-100 hover:bg-orange-100"
            ><PlayfulText text={" ✨ "} />{i}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <div className="font-fun text-sm font-600 text-slate-500">Pick a style</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {STYLES.map((s) => (
              <button
                key={s.key}
                onClick={() => setStyle(s.key)}
                className={`rounded-full px-4 py-2 font-fun text-sm font-700 ring-1 transition ${
                  style === s.key
                    ? "bg-tangerine text-white ring-tangerine shadow"
                    : "bg-white text-slate-500 ring-orange-100 hover:bg-orange-50"
                }`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          className="mt-5 rounded-full bg-tangerine px-8 py-3 font-fun text-lg font-700 text-white shadow-lg shadow-tangerine/30 transition hover:scale-105 disabled:opacity-60"
        >
          {loading ? "Painting your picture… 🖌️" : "Make my picture! 🪄"}
        </button>
        {notice && <p className="mt-3 font-round text-amber-600">{notice}</p>}
        {error && <p className="mt-3 text-coral">{error}</p>}
      </div>

      {imageURL && (
        <div className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-orange-100">
          {score != null && (
            <div className="mb-4 inline-block rounded-full bg-mint/20 px-4 py-1 font-fun font-700 text-emerald-600">
              +{score}<PlayfulText text={" points earned! 🎉 "} /></div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageURL}
            alt={prompt}
            className="w-full rounded-2xl ring-1 ring-orange-100"
          />
          {!playing ? (
            <button
              onClick={() => setPlaying(true)}
              className="mt-4 rounded-full bg-grape px-6 py-3 font-fun font-700 text-white shadow"
            ><PlayfulText text={" Play a puzzle 🧩 "} /></button>
          ) : (
            <div className="mt-5">
              <JigsawBoard imageURL={imageURL} />
              <button onClick={() => setPlaying(false)} className="mt-3 font-fun text-sm font-600 text-slate-400 hover:text-coral">
                ← Back to my picture
              </button>
            </div>
          )}

          <button
            onClick={() => { setImageURL(null); setScore(null); setPrompt(""); }}
            className="mt-6 rounded-full bg-sky-500 px-6 py-3 font-fun font-700 text-white shadow"
          ><PlayfulText text={" Make another! 🎨 "} /></button>
        </div>
      )}
    </div>
  );
}
