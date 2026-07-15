"use client";

import { useState } from "react";
import { useReadAloud } from "@/lib/use-read-aloud";
import type { StoryPage } from "@/lib/portal-queries";

/** Re-reads a saved story page by page, with narration for emerging readers. */
export function SavedStoryReader({ pages }: { pages: StoryPage[] }) {
  const { speak, prefetch, speaking } = useReadAloud();
  const [playing, setPlaying] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      {pages.map((p, i) => {
        const busy = speaking && playing === i;
        return (
          <div key={i} className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-grape/20">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={p.text} className="mx-auto max-h-72 w-auto max-w-full rounded-2xl object-contain ring-1 ring-amber-100" />
            ) : (
              p.emojis && <div className="text-center text-5xl">{p.emojis}</div>
            )}
            <p className="mt-3 whitespace-pre-line text-center font-round text-xl font-600 text-slate-700">{p.text}</p>
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => {
                  setPlaying(i);
                  speak(p.text);
                  prefetch(pages[i + 1]?.text); // warm the next page while this one plays
                }}
                className="rounded-full bg-amber-100 px-4 py-1.5 font-fun text-sm font-700 text-amber-700 transition hover:bg-amber-200"
              >
                {busy ? "🔈 Reading…" : "🔊 Read to me"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
