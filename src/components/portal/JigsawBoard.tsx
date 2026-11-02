"use client";
import { PlayfulText } from "@/components/public/PlaySymbol";


import { useState, type CSSProperties } from "react";

const DIFFS = [
  { name: "Easy", grid: 3, base: 40 },
  { name: "Medium", grid: 4, base: 70 },
  { name: "Hard", grid: 5, base: 100 },
] as const;

function shuffled(n: number): number[] {
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** Background-tile style for the piece whose home position is `home`. */
function pieceStyle(home: number, grid: number, imageURL: string): CSSProperties {
    const col = home % grid;
    const row = Math.floor(home / grid);
    return {
        backgroundImage: `url(${imageURL})`,
        backgroundSize: `${grid * 100}%`,
        backgroundPosition: `${(col * 100) / (grid - 1)}% ${(row * 100) / (grid - 1)}%`,
    };
}

type Sel = { from: "tray" | "board"; pos: number } | null;

export function JigsawBoard({ imageURL, artworkId }: { imageURL: string; artworkId?: number }) {
    const squareSize = DIFFS[0].grid * DIFFS[0].grid as number;
    const [grid, setGrid] = useState(DIFFS[0].grid as number);
    const [base, setBase] = useState(DIFFS[0].base as number);
    const [board, setBoard] = useState<(number | null)[]>(() => Array(squareSize).fill(null));
    const [tray, setTray] = useState<number[]>(() => shuffled(squareSize));
    const [sel, setSel] = useState<Sel>(null);
    const [peek, setPeek] = useState(false);
    const [solved, setSolved] = useState(false);
    const [earned, setEarned] = useState<number | null>(null);

    function newGame(g: number, b: number) {
        setGrid(g); setBase(b);
        setBoard(Array(g * g).fill(null));
        setTray(shuffled(g * g));
        setSel(null);
        setPeek(false);
        setSolved(false);
        setEarned(null);
    }

    function tapTray(i: number) {
        if (solved) return;
        setSel((s) => (s?.from === "tray" && s.pos === i ? null : { from: "tray", pos: i }));
    }

    function tapSlot(d: number) {
        if (solved) return;
        if (!sel) {
            if (board[d] !== null) {
                setSel({ from: "board", pos: d }); //pick up a placed piece
            }
            return;
        }
        // Move the selected piece into slot d, returning any displaced piece to the source.
        const nextBoard = board.slice();
        const nextTray = tray.slice();
        const moving = sel.from === "tray" ? nextTray[sel.pos] : nextBoard[sel.pos]!;
        const displaced = nextBoard[d]; // may be null
        nextBoard[d] = moving;
        if (sel.from === "tray") {
            nextTray.splice(sel.pos, 1); // remove the piece from the tray
            if (displaced !== null) {
                nextTray.push(displaced); // return the displaced piece to the tray
            }
        } else {
            nextBoard[sel.pos] = displaced;
        }
        setBoard(nextBoard);
        setTray(nextTray);
        setSel(null);
        if (nextTray.length === 0 && nextBoard.every((p, idx) => p === idx)) {
            finish();
        }
    }
    async function finish() {
        setSolved(true);
        setEarned(base);
        try {
            await fetch(`/api/learn/score`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ activitySlug: "ai-jigsaw", score: base, metadata: { artworkId, grid } }),
            });
        } catch {
            /* points best-effort */
        }
    }

    return (
      <div>
      {/* Difficulty + peek */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {DIFFS.map((d) => (
          <button key={d.grid} onClick={() => newGame(d.grid, d.base)}
            className={`rounded-full px-4 py-2 font-fun text-sm font-700 ring-1 transition ${
              grid === d.grid ? "bg-tangerine text-white ring-tangerine shadow" : "bg-white text-slate-500 ring-orange-100 hover:bg-orange-50"
            }`}>
            {d.name} ({d.grid}×{d.grid})
          </button>
        ))}
        <button onClick={() => setPeek((p) => !p)}
          className="ml-auto rounded-full bg-sky/15 px-4 py-2 font-fun text-sm font-700 text-sky-600 ring-1 ring-sky/30">
          {peek ? "Hide" : "Peek"}<PlayfulText text={" 👀 "} /></button>
      </div>

      {/* Board */}
      <div className="relative grid aspect-square w-full max-w-md gap-[2px] rounded-2xl bg-orange-100 p-[2px]"
        style={{ gridTemplateColumns: `repeat(${grid}, 1fr)` }}>
        {board.map((home, s) => (
          <button key={s} onClick={() => tapSlot(s)} aria-label={`slot ${s + 1}`}
            className={`aspect-square rounded-md transition ${
              home === null ? "border-2 border-dashed border-orange-300/70 bg-white/40"
              : sel?.from === "board" && sel.pos === s ? "ring-4 ring-coral" : "ring-1 ring-white/40"
            }`}
            style={home === null ? undefined : pieceStyle(home, grid, imageURL)} />
        ))}
        {/* Peek overlay */}
        {peek && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageURL} alt="" className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl object-cover opacity-30" />
        )}
      </div>

      {/* Tray */}
      <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-white p-3 ring-1 ring-orange-100">
        {tray.length === 0 && !solved && <span className="font-round text-sm text-slate-400">All pieces placed — tap two to swap if needed!</span>}
        {tray.map((home, i) => (
          <button key={home} onClick={() => tapTray(i)} aria-label={`piece ${home + 1}`}
            className={`h-16 w-16 rounded-md transition ${
              sel?.from === "tray" && sel.pos === i ? "ring-4 ring-coral scale-95" : "ring-1 ring-orange-100"
            }`}
            style={pieceStyle(home, grid, imageURL)} />
        ))}
      </div>

      {solved && (
        <div className="mt-4 rounded-2xl bg-mint/20 p-4 text-center font-fun font-700 text-emerald-600">
          You solved it! +{earned}<PlayfulText text={" points 🎉 "} /><div>
            <button onClick={() => newGame(grid, base)} className="mt-3 rounded-full bg-sky-500 px-6 py-2 font-700 text-white shadow"><PlayfulText text={"Play again 🔁"} /></button>
          </div>
        </div>
      )}
      </div>
    );
}
