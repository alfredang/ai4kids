"use client";
import { PlayfulText } from "@/components/public/PlaySymbol";


/**
 * Client for the three card games. One component drives every phase — menu,
 * lobby, in-play board and results — and every mode (solo / co-op / versus).
 *
 * The server is authoritative: each action POSTs to /api/learn/cards/* and the
 * returned, viewer-redacted state replaces ours. A ~1.2s `sync` poll keeps
 * teammates in step (same poll-based approach as the escape rooms). The board
 * to render is chosen from `state.game.kind`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { modeLabel, type CardGameMeta, type CardGameMode } from "@/lib/card-games/meta";
import type { CardStateDTO } from "@/lib/card-session";

/* ---- View shapes (mirror each engine's view()) ---- */
type MemoryView = {
  kind: "memory";
  cards: { id: number; face: "word" | "emoji"; label: string | null; matched: boolean; flipped: boolean; matchedBy: number | null }[];
  turnPlayerId: number;
  yourTurn: boolean;
  mismatch: boolean;
  scores: Record<number, number>;
  flips: number;
  pairsTotal: number;
  pairsFound: number;
};
type DiscardView = {
  kind: "discard";
  piles: number[];
  yourHand: number[];
  hands: Record<number, number>;
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
  canPlay: boolean;
};
type MathView = {
  kind: "math";
  target: number;
  discardTop: number;
  drawCount: number;
  yourHand: number[];
  hands: Record<number, number>;
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
};
type BeatDieView = {
  kind: "beatdie";
  die: number | null;
  drawCount: number;
  yourHand: number[];
  hands: Record<number, number>;
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
  canBeat: boolean;
};
type ShowdownResult = {
  plays: Record<number, number[]>;
  sums: Record<number, number>;
  draw: boolean;
  highIds: number[];
  lowIds: number[];
  transferred: number[];
  discarded: number[];
  eliminatedThisRound: number[];
};
type ShowdownView = {
  kind: "showdown";
  stars: Record<number, number>;
  eliminated: number[];
  active: number[];
  handCounts: Record<number, number>;
  yourHand: number[];
  youEliminated: boolean;
  yourSelection: number[] | null;
  committed: Record<number, boolean>;
  waitingOn: number;
  lastResult: ShowdownResult | null;
  starsToWin: number;
  turnPlayerId: number;
  yourTurn: boolean;
};
type MatchColoursView = {
  kind: "matchcolours";
  colours: { key: string; label: string; hex: string; emoji: string }[];
  round: number;
  roundsTotal: number;
  final: boolean;
  pool: number[];
  mapping: number[]; // mapping[i] = colour id tied to number (i + 1)
  prompt: number;
  startAt: number;
  revealAt: number;
  deadlineAt: number;
  resolved: boolean;
  resultUntil: number | null;
  correctColour: number | null;
  scores: Record<number, number>;
  points: Record<number, number> | null;
  yourPoints: number | null;
  answered: Record<number, boolean>;
  yourAnswer: number | null; // colour id, -1 = no answer, null = not yet
  inRound: boolean;
  serverNow: number;
  winner: number | null;
  turnPlayerId: number;
  yourTurn: boolean;
};
type MakeTenView = {
  kind: "maketen";
  cards: { id: number; value: number }[];
  cleared: number;
  goal: number;
  round: number;
  roundMs: number;
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
};
type WheelView = {
  kind: "wheel";
  wheel: string[];
  targetAnimal: string;
  targetCount: number;
  cards: { id: number; counts: Record<string, number> }[];
  round: number;
  roundsTotal: number;
  subround: number;
  subroundsTotal: number;
  roundMs: number;
  lastRound: boolean;
  wrongPicks: number[];
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
};
type OddOneView = {
  kind: "oddone";
  animals: string[];
  cards: { id: number; counts: Record<string, number> }[];
  round: number;
  roundsTotal: number;
  subround: number;
  subroundsTotal: number;
  roundMs: number;
  wrongPicks: number[];
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
};
type SeqView = {
  kind: "sequence";
  cards: { id: number; letter: string; faceUp: boolean; wrong: boolean }[];
  order: string[];
  progress: number;
  total: number;
  wrong: boolean;
  turnPlayerId: number;
  yourTurn: boolean;
  finished: number[];
};
type GameView =
  | MemoryView
  | DiscardView
  | MathView
  | BeatDieView
  | ShowdownView
  | MatchColoursView
  | MakeTenView
  | WheelView
  | OddOneView
  | SeqView;

async function post(path: string, body: unknown): Promise<{ code?: string; state: CardStateDTO }> {
  const r = await fetch(`/api/learn/cards/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

/** Memory Match board-size choices (pairs of cards). */
const PAIR_CHOICES = [6, 8, 10, 12] as const;

export function CardGamePlayer({ game }: { game: CardGameMeta }) {
  const [state, setState] = useState<CardStateDTO | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Memory Match only: how many pairs to deal. Chosen before the game starts.
  const [pairs, setPairs] = useState(8);
  const isMemory = game.slug === "memory-match";

  const statusRef = useRef<string>("");
  statusRef.current = state?.status ?? "";

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const createGame = (mode: CardGameMode) =>
    run(async () => {
      const data = await post("create", {
        gameSlug: game.slug,
        mode,
        ...(isMemory ? { options: { pairs } } : {}),
      });
      setCode(data.code ?? null);
      setState(data.state);
    });

  const joinGame = (raw: string) =>
    run(async () => {
      const data = await post("join", { code: raw.trim().toUpperCase(), gameSlug: game.slug });
      setCode(data.code ?? null);
      setState(data.state);
    });

  const startGame = () =>
    run(async () => {
      if (!code) return;
      const data = await post("start", {
        code,
        ...(isMemory ? { options: { pairs } } : {}),
      });
      setState(data.state);
    });

  const sendMove = useCallback(
    (move: unknown) =>
      run(async () => {
        if (!code) return;
        const data = await post("move", { code, move });
        setState(data.state);
      }),
    [code, run],
  );

  const leave = () => {
    setCode(null);
    setState(null);
    setError(null);
  };

  // Poll for shared state until the game is done.
  useEffect(() => {
    if (!code) return;
    let stop = false;
    let inflight = false;
    const tick = async () => {
      if (stop || inflight || statusRef.current === "done") return;
      inflight = true;
      try {
        const data = await post("sync", { code });
        if (!stop) setState(data.state);
      } catch {
        /* transient — keep polling */
      } finally {
        inflight = false;
      }
    };
    const id = setInterval(tick, 1200);
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [code]);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-fun text-sm font-600">
        <Link href="/learn" className="text-slate-400 hover:text-coral">← Back to activities</Link>
        <span aria-hidden className="text-slate-300">·</span>
        <Link href="/learn/cards" className="text-slate-400 hover:text-coral"><PlayfulText text={"🕹️ Brain Arcade"} /></Link>
      </div>

      {/* Title */}
      <div className={`mt-3 flex items-center gap-4 rounded-[2rem] bg-white p-5 shadow-sm ring-1 ${game.ring}`}>
        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-4xl ${game.accent}`}>
          <PlayfulText text={game.emoji} />
        </div>
        <div className="min-w-0">
          <h1 className="font-fun text-2xl font-700 text-slate-900">{game.title}</h1>
          <p className="font-round text-slate-500">{game.tagline}</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-coral/10 px-4 py-3 font-round text-sm text-coral ring-1 ring-coral/20">
          {error}
        </div>
      )}

      {!state || !code ? (
        <Menu
          game={game}
          busy={busy}
          onSolo={() => createGame("solo")}
          onHost={createGame}
          onJoin={joinGame}
          pairControl={isMemory ? <PairSelector pairs={pairs} setPairs={setPairs} disabled={busy} /> : null}
        />
      ) : state.status === "lobby" ? (
        <Lobby
          game={game}
          state={state}
          code={code}
          busy={busy}
          onStart={startGame}
          onLeave={leave}
          pairControl={isMemory && state.hostId === state.you ? <PairSelector pairs={pairs} setPairs={setPairs} disabled={busy} /> : null}
        />
      ) : state.status === "done" ? (
        <Results state={state} onAgain={leave} />
      ) : (
        <Board state={state} busy={busy} onMove={sendMove} />
      )}
    </div>
  );
}

/** Memory Match board-size picker (shown to the host / solo player pre-game). */
function PairSelector({
  pairs,
  setPairs,
  disabled,
}: {
  pairs: number;
  setPairs: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <div className="font-fun text-sm font-700 text-slate-700">How many cards?</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {PAIR_CHOICES.map((n) => (
          <button
            key={n}
            onClick={() => setPairs(n)}
            disabled={disabled}
            className={`rounded-full px-3.5 py-1.5 font-fun text-sm font-700 transition disabled:opacity-50 ${
              pairs === n ? "bg-grape text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {n * 2}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu — pick a mode or join a friend's game                          */
/* ------------------------------------------------------------------ */
function Menu({
  game,
  busy,
  onSolo,
  onHost,
  onJoin,
  pairControl,
}: {
  game: CardGameMeta;
  busy: boolean;
  onSolo: () => void;
  onHost: (mode: CardGameMode) => void;
  onJoin: (code: string) => void;
  pairControl?: React.ReactNode;
}) {
  const [joinCode, setJoinCode] = useState("");
  const multiModes = game.modes.filter((m) => m !== "solo") as CardGameMode[];

  return (
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      {/* How to play */}
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h2 className="font-fun text-lg font-700 text-slate-800">How to play</h2>
        <ul className="mt-3 space-y-2">
          {game.how.map((line, i) => (
            <li key={i} className="flex gap-2 font-round text-sm text-slate-600">
              <span className="text-coral">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Choices */}
      <div className="flex flex-col gap-4">
        {pairControl}
        {game.modes.includes("solo") && (
          <button
            onClick={onSolo}
            disabled={busy}
            className="rounded-3xl bg-grape px-5 py-4 text-left font-fun font-700 text-white shadow transition hover:scale-[1.02] disabled:opacity-50"
          ><PlayfulText text={" 🎯 Play Solo "} /><span className="block font-round text-sm font-500 text-white/80">
              Beat the clock on your own.
            </span>
          </button>
        )}

        {multiModes.length > 0 && (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
            <div className="font-fun font-700 text-slate-800">Play with friends</div>
            <p className="font-round text-xs text-slate-400">Up to {game.maxPlayers} players, on their own devices.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {multiModes.map((m) => (
                <button
                  key={m}
                  onClick={() => onHost(m)}
                  disabled={busy}
                  className="rounded-full bg-coral px-4 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
                >
                  Host {modeLabel(m)}
                </button>
              ))}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="font-fun text-sm font-700 text-slate-700">Got a code?</div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (joinCode.trim()) onJoin(joinCode);
                }}
                className="mt-2 flex gap-2"
              >
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="LION42"
                  maxLength={12}
                  className="w-32 rounded-full border-2 border-slate-200 px-4 py-2 font-mono font-700 uppercase tracking-wider text-slate-700 outline-none focus:border-sky"
                />
                <button
                  type="submit"
                  disabled={busy || !joinCode.trim()}
                  className="rounded-full bg-sky px-4 py-2 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lobby — share the code, wait for players, host starts               */
/* ------------------------------------------------------------------ */
function Lobby({
  game,
  state,
  code,
  busy,
  onStart,
  onLeave,
  pairControl,
}: {
  game: CardGameMeta;
  state: CardStateDTO;
  code: string;
  busy: boolean;
  onStart: () => void;
  onLeave: () => void;
  pairControl?: React.ReactNode;
}) {
  const youHost = state.hostId === state.you;
  const count = state.players.length;
  const enough = count >= game.minPlayers;
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100 text-center">
      <div className="font-fun text-sm font-600 text-slate-400">Share this code with your friends</div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-sky/10 px-6 py-3 font-mono text-3xl font-700 tracking-widest text-sky-700 ring-1 ring-sky/20 transition hover:bg-sky/15"
        title="Tap to copy"
      >
        {code} <span className="text-base">{copied ? "✓" : "📋"}</span>
      </button>
      <div className="mt-1 font-round text-xs text-slate-400">{modeLabel(state.mode)} · {game.title}</div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {state.players.map((p) => (
          <span
            key={p.learnerId}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1.5 font-fun text-sm font-700 text-slate-700 ring-1 ring-slate-100"
          >
            {p.avatar ?? "🙂"} {p.name}{p.learnerId === state.you ? " (you)" : ""}
            {p.isHost && <span className="text-amber-500" title="Host">★</span>}
          </span>
        ))}
      </div>

      {pairControl && <div className="mt-5 flex justify-center">{pairControl}</div>}

      <div className="mt-6">
        {youHost ? (
          <button
            onClick={onStart}
            disabled={busy || !enough}
            className="rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
          >
            {enough ? "Start game ▶" : `Need ${game.minPlayers}+ players`}
          </button>
        ) : (
          <div className="font-round text-slate-500"><PlayfulText text={"Waiting for the host to start… 🕒"} /></div>
        )}
        <div>
          <button onClick={onLeave} className="mt-3 font-fun text-sm font-600 text-slate-400 hover:text-coral">
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */
function Results({ state, onAgain }: { state: CardStateDTO; onAgain: () => void }) {
  const nameById = new Map(state.players.map((p) => [p.learnerId, p.name]));
  const youWon = state.winners[0] === state.you;
  const solo = state.mode === "solo";
  const coop = state.mode === "coop";
  // A solo game that finished with no winner = the player ran out of time.
  const soloLost = solo && state.winners.length === 0;

  // Solo time + personal best. `bestMs` already includes this run, so this run
  // beat (or tied) the record exactly when its time equals the best.
  const start = state.startedAt ? new Date(state.startedAt).getTime() : null;
  const end = state.finishedAt ? new Date(state.finishedAt).getTime() : null;
  const thisMs = start != null && end != null ? end - start : null;
  const newBest = solo && !soloLost && thisMs != null && state.bestMs != null && thisMs <= state.bestMs;

  return (
    <div className="mt-5 rounded-3xl bg-gradient-to-br from-sunny/30 to-coral/20 p-8 text-center shadow-sm ring-1 ring-amber-100">
      <div className="text-6xl">{soloLost ? "😮" : youWon || coop || solo ? "🏆" : "🎉"}</div>
      <h2 className="mt-2 font-fun text-2xl font-700 text-slate-900">
        {soloLost
          ? "So close!"
          : solo
            ? "You did it!"
            : coop
              ? "You cleared it together!"
              : youWon
                ? "You win! 🎉"
                : `${nameById.get(state.winners[0]) ?? "Someone"} wins!`}
      </h2>

      {soloLost && (
        <p className="mt-2 font-round text-slate-500">You ran out of time — give it another go!</p>
      )}

      {solo && !soloLost && thisMs != null && (
        <div className="mx-auto mt-4 max-w-xs">
          <div className="rounded-2xl bg-white/70 px-5 py-3 font-fun font-700 text-slate-700 shadow-sm">
            <span className="tabular-nums"><PlayfulText text={"⏱️ Your time: "} />{fmtTime(thisMs)}</span>
            {state.bestMs != null && (
              <span className="ml-3 tabular-nums text-amber-600"><PlayfulText text={"🏆 Best: "} />{fmtTime(state.bestMs)}</span>
            )}
          </div>
          {newBest && (
            <div className="mt-2 font-fun font-700 text-emerald-600"><PlayfulText text={"✨ New personal best!"} /></div>
          )}
        </div>
      )}

      {!solo && !coop && (
        <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left">
          {state.winners.map((id, i) => (
            <li
              key={id}
              className={`flex items-center justify-between rounded-2xl px-4 py-2 font-fun font-700 ${
                i === 0 ? "bg-white text-amber-600 shadow-sm" : "bg-white/60 text-slate-600"
              }`}
            >
              <span>{["🥇", "🥈", "🥉"][i] ?? "🎖️"} {nameById.get(id) ?? "Player"}{id === state.you ? " (you)" : ""}</span>
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={onAgain}
        className="mt-6 rounded-full bg-coral px-8 py-3 font-fun text-lg font-700 text-white shadow transition hover:scale-105"
      ><PlayfulText text={" Play again ▶ "} /></button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Solo time-attack clock (live ticking) + personal best               */
/* ------------------------------------------------------------------ */
function fmtTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function SoloClock({
  startedAt,
  finishedAt,
  bestMs,
}: {
  startedAt: string | null;
  finishedAt: string | null;
  bestMs: number | null;
}) {
  const start = startedAt ? new Date(startedAt).getTime() : null;
  const end = finishedAt ? new Date(finishedAt).getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (end || !start) return; // frozen once finished
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [end, start]);
  const elapsed = start != null ? (end ?? now) - start : 0;

  return (
    <div className="mb-4 flex items-center justify-center gap-3 font-fun font-700">
      <span className="rounded-2xl bg-sky/10 px-4 py-1.5 text-sky-700 ring-1 ring-sky/20 tabular-nums"><PlayfulText text={" ⏱️ "} />{fmtTime(elapsed)}
      </span>
      {bestMs != null && (
        <span className="rounded-2xl bg-amber-50 px-4 py-1.5 text-amber-600 ring-1 ring-amber-100 tabular-nums"><PlayfulText text={" 🏆 Best "} />{fmtTime(bestMs)}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Board dispatcher + turn banner                                      */
/* ------------------------------------------------------------------ */
function Board({ state, busy, onMove }: { state: CardStateDTO; busy: boolean; onMove: (m: unknown) => void }) {
  const game = state.game as GameView;
  const nameById = new Map(state.players.map((p) => [p.learnerId, p.name]));
  // Showdown and Matching Colours are simultaneous (no turns), so they skip the
  // standard turn banner.
  const noBanner = game.kind === "showdown" || game.kind === "matchcolours";
  const showBanner = state.mode !== "solo" && !noBanner;
  const turnName = noBanner
    ? ""
    : game.yourTurn
      ? "Your turn"
      : `${nameById.get(game.turnPlayerId) ?? "…"}'s turn`;

  return (
    <div className="mt-5">
      {state.mode === "solo" && (
        <SoloClock startedAt={state.startedAt} finishedAt={state.finishedAt} bestMs={state.bestMs} />
      )}
      {showBanner && (
        <div
          className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-2.5 font-fun font-700 ring-1 ${
            game.yourTurn ? "bg-mint/15 text-emerald-700 ring-mint/30" : "bg-slate-50 text-slate-500 ring-slate-100"
          }`}
        >
          <span>{game.yourTurn ? "🟢 " : "🕒 "}{turnName}</span>
          <span className="flex flex-wrap gap-1.5 font-round text-xs">
            {state.players.map((p) => (
              <span
                key={p.learnerId}
                className={`rounded-full px-2 py-0.5 ${
                  p.learnerId === game.turnPlayerId ? "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200" : "text-slate-400"
                }`}
              >
                {p.avatar ?? "🙂"} {p.name}
              </span>
            ))}
          </span>
        </div>
      )}

      {game.kind === "memory" && <MemoryBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "discard" && <DiscardBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "math" && <MathBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "beatdie" && <BeatDieBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "showdown" && (
        <ShowdownBoard view={game} players={state.players} busy={busy} onMove={onMove} />
      )}
      {game.kind === "matchcolours" && (
        <MatchColoursBoard view={game} players={state.players} busy={busy} onMove={onMove} />
      )}
      {game.kind === "maketen" && <MakeTenBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "wheel" && <WheelBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "oddone" && <OddOneBoard view={game} busy={busy} onMove={onMove} />}
      {game.kind === "sequence" && <AlphabetLockBoard view={game} busy={busy} onMove={onMove} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared bits for the timed solo games                                */
/* ------------------------------------------------------------------ */

/**
 * A per-round countdown that restarts whenever `restartKey` changes and fires
 * `onExpire` once when it hits zero. The board owns the clock (these solo games
 * have no server tick); on expiry the board POSTs a `timeout` move = a loss.
 */
function useRoundTimer(roundMs: number, restartKey: string, enabled: boolean, onExpire: () => void): number {
  const [remaining, setRemaining] = useState(roundMs);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  useEffect(() => {
    if (!enabled) {
      setRemaining(roundMs);
      return;
    }
    const deadline = Date.now() + roundMs;
    setRemaining(roundMs);
    let fired = false;
    const id = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        clearInterval(id);
        expireRef.current();
      }
    }, 50);
    return () => clearInterval(id);
    // Restart only on a new round identity (roundMs is constant within a round).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey, enabled]);
  return remaining;
}

function TimerBar({ remaining, total }: { remaining: number; total: number }) {
  const frac = Math.max(0, Math.min(1, remaining / Math.max(1, total)));
  const secs = Math.ceil(remaining / 1000);
  const urgent = remaining <= 2000;
  return (
    <div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${urgent ? "bg-coral" : "bg-sky"}`}
          style={{ width: `${frac * 100}%` }}
        />
      </div>
      <div className={`mt-1 text-center font-fun text-sm font-700 tabular-nums ${urgent ? "text-coral" : "text-slate-500"}`}><PlayfulText text={" ⏱ "} />{secs}s
      </div>
    </div>
  );
}

/** Deterministic scatter of a card's animals (seeded by id, stable across renders). */
function scatter(counts: Record<string, number>, seed: number): string[] {
  const arr: string[] = [];
  for (const [a, n] of Object.entries(counts)) for (let i = 0; i < n; i++) arr.push(a);
  let s = (seed + 1) >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------------ */
/* Make Ten board (timed number bonds)                                 */
/* ------------------------------------------------------------------ */
function MakeTenBoard({ view, busy, onMove }: { view: MakeTenView; busy: boolean; onMove: (m: unknown) => void }) {
  const [sel, setSel] = useState<number[]>([]);
  // Selection resets whenever the board changes (a pair cleared, or a retry).
  useEffect(() => {
    setSel([]);
  }, [view.cleared, view.cards.length]);

  const remaining = useRoundTimer(view.roundMs, String(view.round), true, () => onMove({ type: "timeout" }));

  const tap = (id: number) => {
    if (busy) return;
    if (sel.includes(id)) {
      setSel(sel.filter((x) => x !== id));
      return;
    }
    if (sel.length >= 2) return;
    const next = [...sel, id];
    if (next.length === 2) {
      setSel([]);
      onMove({ type: "clear", cards: next });
    } else {
      setSel(next);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-fun text-sm font-700 text-slate-500">
        <span>Round {view.round}/{view.goal}</span>
        <span>Cleared {view.cleared}/{view.goal}</span>
      </div>
      <TimerBar remaining={remaining} total={view.roundMs} />
      <p className="mt-2 text-center font-round text-xs text-slate-400">Tap two cards that add up to 10.</p>
      <div className="mx-auto mt-3 grid grid-cols-6 gap-2" style={{ maxWidth: "26rem" }}>
        {view.cards.map((c) => {
          const on = sel.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => tap(c.id)}
              disabled={busy}
              className={`flex aspect-[3/4] items-center justify-center rounded-xl font-fun text-2xl font-700 shadow-sm transition disabled:opacity-60 ${
                on ? "scale-[1.06] bg-mint text-white ring-2 ring-mint/60" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:scale-[1.03]"
              }`}
            >
              {c.value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Animal Count board (spot-the-count, spinning wheel + timer)         */
/* ------------------------------------------------------------------ */
function WheelBoard({ view, busy, onMove }: { view: WheelView; busy: boolean; onMove: (m: unknown) => void }) {
  const viewRef = useRef(view);
  viewRef.current = view;
  const [spinning, setSpinning] = useState(!view.lastRound);
  const [spinIdx, setSpinIdx] = useState(0);
  const [ready, setReady] = useState(!view.lastRound);

  // Spin the wheel at the start of each round (the last round has one animal, so
  // it just lands without spinning and gets a "Final Round!" prompt instead).
  useEffect(() => {
    const v = viewRef.current;
    const targetIdx = Math.max(0, v.wheel.indexOf(v.targetAnimal));
    setReady(!v.lastRound);
    if (v.lastRound || v.wheel.length <= 1) {
      setSpinIdx(targetIdx);
      setSpinning(false);
      return;
    }
    setSpinning(true);
    const n = v.wheel.length;
    const steps = n * 3 + targetIdx;
    let s = 0;
    let d = 55;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      setSpinIdx(s % n);
      if (s >= steps) {
        setSpinIdx(targetIdx);
        setSpinning(false);
        return;
      }
      s += 1;
      d += 7; // decelerate
      timer = setTimeout(step, d);
    };
    timer = setTimeout(step, d);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.round]);

  const remaining = useRoundTimer(
    view.roundMs,
    `${view.round}-${view.subround}`,
    !spinning && ready,
    () => onMove({ type: "timeout" }),
  );

  return (
    <div>
      <div className="mb-3 font-fun text-sm font-700 text-slate-500">
        Round {view.round}/{view.roundsTotal} · Pick {view.subround}/{view.subroundsTotal}
      </div>

      {/* The wheel — a strip of the remaining animals, one highlighted. */}
      <div className="flex h-16 items-center justify-center gap-2">
        {view.wheel.map((a, i) => {
          const on = i === spinIdx;
          return (
            <div
              key={a}
              className={`flex items-center justify-center rounded-2xl transition-all ${
                on ? "h-14 w-14 bg-coral/20 text-3xl ring-2 ring-coral/50" : "h-11 w-11 bg-slate-50 text-2xl"
              }`}
            >
              {a}
            </div>
          );
        })}
      </div>

      {spinning ? (
        <p className="mt-4 text-center font-fun font-700 text-slate-400">Choosing an animal…</p>
      ) : !ready ? (
        <div className="mt-4 rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
          <div className="text-5xl"><PlayfulText text={"🏁"} /></div>
          <div className="mt-2 font-fun text-xl font-700 text-slate-800">Final Round!</div>
          <p className="mt-1 font-round text-sm text-slate-500">
            Just one animal left — {view.targetAnimal}. Get this card right to win!
          </p>
          <button
            onClick={() => setReady(true)}
            className="mt-4 rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105"
          ><PlayfulText text={" I&apos;m ready! ▶ "} /></button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex items-center justify-center gap-2">
            <span className="font-round text-sm text-slate-500">Find the card with</span>
            <span className="rounded-xl bg-coral/15 px-2.5 py-1 font-fun text-lg font-700 text-coral">
              {view.targetCount} {view.targetAnimal}
            </span>
          </div>
          <div className="mt-3">
            <TimerBar remaining={remaining} total={view.roundMs} />
          </div>
          {view.wrongPicks.length > 0 && (
            <p className="mt-1 text-center font-fun text-xs font-700 text-coral"><PlayfulText text={" ❌ no more chances left — choose carefully! "} /></p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3">
            {view.cards.map((c) => {
              const wrong = view.wrongPicks.includes(c.id);
              const emojis = scatter(c.counts, c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => onMove({ type: "pick", cardId: c.id })}
                  disabled={busy || wrong}
                  className={`flex min-h-[6rem] items-center justify-center rounded-2xl p-3 text-center text-2xl leading-relaxed shadow-sm ring-1 transition ${
                    wrong ? "bg-coral/10 ring-coral/40" : "bg-white ring-slate-200 hover:scale-[1.02]"
                  }`}
                >
                  {emojis.length ? emojis.join(" ") : "—"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Odd One Out board (spot-the-difference + timer)                     */
/* ------------------------------------------------------------------ */
function OddOneBoard({ view, busy, onMove }: { view: OddOneView; busy: boolean; onMove: (m: unknown) => void }) {
  const remaining = useRoundTimer(
    view.roundMs,
    `${view.round}-${view.subround}`,
    true,
    () => onMove({ type: "timeout" }),
  );

  return (
    <div>
      <div className="mb-2 font-fun text-sm font-700 text-slate-500">
        Round {view.round}/{view.roundsTotal} · Pick {view.subround}/{view.subroundsTotal}
      </div>
      <p className="text-center font-fun text-lg font-700 text-slate-800">Tap the card that&apos;s different</p>
      <div className="mt-3">
        <TimerBar remaining={remaining} total={view.roundMs} />
      </div>
      {view.wrongPicks.length > 0 && (
        <p className="mt-1 text-center font-fun text-xs font-700 text-coral"><PlayfulText text={"❌ one mistake — look closely!"} /></p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {view.cards.map((c) => {
          const wrong = view.wrongPicks.includes(c.id);
          // Canonical order (no scatter): the matching cards render identically,
          // so the odd one stands out.
          const emojis = Object.entries(c.counts).flatMap(([a, n]) => Array.from({ length: n }, () => a));
          return (
            <button
              key={c.id}
              onClick={() => onMove({ type: "pick", cardId: c.id })}
              disabled={busy || wrong}
              className={`flex min-h-[6rem] items-center justify-center rounded-2xl p-3 text-center text-2xl leading-relaxed shadow-sm ring-1 transition ${
                wrong ? "bg-coral/10 ring-coral/40" : "bg-white ring-slate-200 hover:scale-[1.02]"
              }`}
            >
              {emojis.length ? emojis.join(" ") : "—"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alphabet Lock board (flip 9 letters in order)                       */
/* ------------------------------------------------------------------ */
function AlphabetLockBoard({ view, busy, onMove }: { view: SeqView; busy: boolean; onMove: (m: unknown) => void }) {
  // After a wrong flip, show the letter briefly, then flip everything back down.
  useEffect(() => {
    if (!view.wrong) return;
    const t = setTimeout(() => onMove({ type: "hide" }), 900);
    return () => clearTimeout(t);
  }, [view.wrong, onMove]);

  const locked = busy || view.wrong;

  return (
    <div>
      <p className="text-center font-fun text-lg font-700 text-slate-800">Flip the letters in ABC order</p>

      {/* The ordered ladder: done letters filled, the next one outlined. */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {view.order.map((l, i) => {
          const done = i < view.progress;
          const next = i === view.progress && !view.wrong;
          return (
            <span
              key={i}
              className={`flex h-7 w-7 items-center justify-center rounded-lg font-fun text-sm font-700 ${
                done
                  ? "bg-mint text-white"
                  : next
                    ? "bg-sky/15 text-sky-700 ring-2 ring-sky/40"
                    : "bg-slate-50 text-slate-300"
              }`}
            >
              {l}
            </span>
          );
        })}
      </div>

      {/* The 3×3 grid. */}
      <div className="mx-auto mt-4 grid max-w-xs grid-cols-3 gap-2.5">
        {view.cards.map((c) => {
          const up = c.faceUp;
          const correct = up && !c.wrong;
          return (
            <button
              key={c.id}
              onClick={() => onMove({ type: "flip", cardId: c.id })}
              disabled={locked || up}
              className={`flex aspect-square items-center justify-center rounded-2xl font-fun text-3xl font-700 shadow-sm transition ${
                c.wrong
                  ? "bg-coral/15 text-coral ring-2 ring-coral/40"
                  : correct
                    ? "bg-white text-emerald-600 ring-2 ring-mint/50"
                    : up
                      ? "bg-white text-slate-800 ring-1 ring-slate-200"
                      : "bg-gradient-to-br from-sky to-grape text-white hover:scale-[1.03]"
              }`}
            >
              {up ? c.letter : <span className="text-white/60">★</span>}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center font-fun text-sm font-700 text-slate-500">
        {view.progress}/{view.total} in order
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Memory board                                                        */
/* ------------------------------------------------------------------ */
function MemoryBoard({ view, busy, onMove }: { view: MemoryView; busy: boolean; onMove: (m: unknown) => void }) {
  // After a mismatch, the current player auto-flips the cards back.
  useEffect(() => {
    if (!view.mismatch || !view.yourTurn) return;
    const t = setTimeout(() => onMove({ type: "next" }), 1100);
    return () => clearTimeout(t);
  }, [view.mismatch, view.yourTurn, onMove]);

  const lock = busy || view.mismatch; // don't accept flips mid-resolve
  const flippedCount = view.cards.filter((c) => c.flipped).length;

  // Smaller cards, more per row as the board grows, capped so they stay compact.
  const total = view.cards.length;
  const cols = total <= 16 ? 4 : total <= 20 ? 5 : 6;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between font-fun text-sm font-700 text-slate-500">
        <span>Pairs found: {view.pairsFound}/{view.pairsTotal}</span>
      </div>
      <div
        className="mx-auto grid gap-2 sm:gap-2.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: `${cols * 4.75}rem` }}
      >
        {view.cards.map((c) => {
          const up = c.flipped || c.matched;
          const disabled = lock || up || !view.yourTurn || flippedCount >= 2;
          return (
            <button
              key={c.id}
              onClick={() => onMove({ type: "flip", cardId: c.id })}
              disabled={disabled}
              className={`flex aspect-square items-center justify-center rounded-xl p-0.5 text-center font-fun font-700 shadow-sm transition ${
                c.matched
                  ? "bg-mint/20 text-emerald-700 ring-1 ring-mint/40"
                  : up
                    ? "scale-[1.05] bg-white text-slate-800 ring-2 ring-sky/40"
                    : "bg-gradient-to-br from-grape to-bubble text-white hover:scale-[1.03]"
              }`}
            >
              {up ? (
                <span
                  className={
                    c.face === "emoji"
                      ? "text-4xl sm:text-5xl"
                      : "break-words text-lg leading-none sm:text-xl"
                  }
                >
                  {c.label}
                </span>
              ) : (
                <span className="text-xl text-white/60">★</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Discard (Tower Tumble) board                                        */
/* ------------------------------------------------------------------ */
function DiscardBoard({ view, busy, onMove }: { view: DiscardView; busy: boolean; onMove: (m: unknown) => void }) {
  // Track the selected card by hand INDEX so only the tapped card highlights,
  // even when the hand holds duplicate values.
  const [sel, setSel] = useState<number | null>(null);

  // Drop a stale index after a play/poll changes the hand.
  useEffect(() => {
    setSel((s) => (s != null && view.yourHand[s] != null ? s : null));
  }, [view.yourHand]);

  const selectedCard = sel != null ? view.yourHand[sel] : null;
  const legalPile = (pileTop: number, card: number) => card === 10 || card > pileTop;
  const canPlayCardOnPile = (pileIdx: number) =>
    selectedCard != null && view.yourTurn && !busy && legalPile(view.piles[pileIdx], selectedCard);

  return (
    <div>
      {/* Piles */}
      <div className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {view.piles.map((top, i) => {
          const active = canPlayCardOnPile(i);
          return (
            <button
              key={i}
              onClick={() => {
                if (active && selectedCard != null) {
                  onMove({ type: "play", pile: i, card: selectedCard });
                  setSel(null);
                }
              }}
              disabled={!active}
              className={`flex aspect-[3/4] flex-col items-center justify-center rounded-2xl text-center shadow-sm transition ${
                top === 0
                  ? "bg-slate-50 text-slate-300 ring-1 ring-dashed ring-slate-200"
                  : "bg-white text-slate-800 ring-1 ring-slate-200"
              } ${active ? "scale-[1.03] ring-2 ring-mint/60" : ""}`}
            >
              <span className="font-fun text-3xl font-700">{top === 0 ? "—" : top}</span>
              <span className="mt-1 font-round text-[10px] text-slate-400">pile {i + 1}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center font-round text-xs text-slate-400">
        {selectedCard != null ? "Tap a glowing pile to play your card." : "Pick a card, then a pile. Play a 10 to clear a pile."}
      </p>

      {/* Hand */}
      <Hand
        cards={view.yourHand}
        selectedIndex={sel}
        onToggle={(idx) => setSel((s) => (s === idx ? null : idx))}
        disabled={!view.yourTurn || busy}
      />

      {/* Actions */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={() => onMove({ type: "pass" })}
          disabled={view.canPlay || !view.yourTurn || busy}
          className="rounded-full bg-slate-100 px-6 py-2.5 font-fun font-700 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
          title={view.canPlay ? "You still have a move!" : "No move — pass your turn"}
        ><PlayfulText text={" Pass 🤷 "} /></button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Math (Number Hunt) board                                            */
/* ------------------------------------------------------------------ */
function makesTarget(cards: number[], target: number): boolean {
  if (cards.length === 1) return cards[0] === target;
  if (cards.length === 2) return cards[0] + cards[1] === target || Math.abs(cards[0] - cards[1]) === target;
  return false;
}

function MathBoard({ view, busy, onMove }: { view: MathView; busy: boolean; onMove: (m: unknown) => void }) {
  const [picked, setPicked] = useState<number[]>([]);

  // Picks are tracked by hand INDEX so two cards of the same value both work.
  // Drop any indices that no longer point at a card (after a move/poll).
  useEffect(() => {
    setPicked((p) => p.filter((idx) => view.yourHand[idx] != null).slice(0, 2));
  }, [view.yourHand]);

  const toggle = (idx: number) => {
    setPicked((p) => {
      if (p.includes(idx)) return p.filter((k) => k !== idx);
      if (p.length >= 2) return p;
      return [...p, idx];
    });
  };
  const pickedValues = picked.map((idx) => view.yourHand[idx]).filter((v) => v != null);
  const readyVals = makesTarget(pickedValues, view.target);

  return (
    <div>
      {/* Target */}
      <div className="flex items-center justify-center">
        <div className="rounded-3xl bg-sky/10 px-6 py-4 text-center ring-1 ring-sky/20">
          <div className="font-round text-xs text-slate-400">make</div>
          <div className="font-fun text-5xl font-700 text-sky-700">{view.target}</div>
        </div>
      </div>
      <p className="mt-2 text-center font-round text-xs text-slate-400">
        Discard one card that equals {view.target}, or two that add or subtract to {view.target}.
      </p>

      {/* Hand (pick by index so duplicates work) */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {view.yourHand.map((card, idx) => {
          const on = picked.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              disabled={!view.yourTurn || busy}
              className={`flex aspect-[3/4] w-14 items-center justify-center rounded-2xl font-fun text-2xl font-700 shadow-sm transition disabled:opacity-50 ${
                on ? "scale-[1.06] bg-sky text-white ring-2 ring-sky/60" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:scale-[1.03]"
              }`}
            >
              {card}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={() => {
            if (readyVals) {
              onMove({ type: "discard", cards: pickedValues });
              setPicked([]);
            }
          }}
          disabled={!readyVals || !view.yourTurn || busy}
          className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-40"
        >
          Discard ✓
        </button>
        <button
          onClick={() => {
            onMove({ type: "draw" });
            setPicked([]);
          }}
          disabled={!view.yourTurn || busy}
          className="rounded-full bg-slate-100 px-6 py-2.5 font-fun font-700 text-slate-600 transition hover:bg-slate-200 disabled:opacity-40"
        ><PlayfulText text={" Draw 🃏 "} /></button>
      </div>
      {picked.length > 0 && !readyVals && (
        <p className="mt-2 text-center font-round text-xs text-coral">
          {pickedValues.join(" & ")} doesn&apos;t make {view.target} yet.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Beat the Die board                                                  */
/* ------------------------------------------------------------------ */
function BeatDieBoard({ view, busy, onMove }: { view: BeatDieView; busy: boolean; onMove: (m: unknown) => void }) {
  const [picked, setPicked] = useState<number[]>([]);

  // Drop stale indices after the hand changes, and clear picks on a new turn.
  useEffect(() => {
    setPicked((p) => p.filter((i) => view.yourHand[i] != null).slice(0, 2));
  }, [view.yourHand]);
  useEffect(() => {
    setPicked([]);
  }, [view.die, view.turnPlayerId]);

  const rolled = view.die != null;
  const pickedValues = picked.map((i) => view.yourHand[i]).filter((v) => v != null);
  const sum = pickedValues.reduce((a, b) => a + b, 0);
  const beats = rolled && sum >= (view.die ?? 0);
  const canDiscard = beats && view.yourTurn && !busy && pickedValues.length >= 1;
  const canDraw = rolled && view.yourTurn && !busy && !view.canBeat;

  const toggle = (idx: number) =>
    setPicked((p) => (p.includes(idx) ? p.filter((k) => k !== idx) : p.length >= 2 ? p : [...p, idx]));

  return (
    <div>
      {/* Die */}
      <div className="flex items-center justify-center">
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow ring-1 ring-emerald-300">
          {rolled ? (
            <>
              <span className="font-fun text-5xl font-700 leading-none">{view.die}</span>
              <span className="mt-1 font-round text-[10px] text-white/80">beat it!</span>
            </>
          ) : (
            <span className="text-4xl"><PlayfulText text={"🎲"} /></span>
          )}
        </div>
      </div>

      {/* Roll prompt / instruction */}
      {!rolled ? (
        <div className="mt-4 text-center">
          {view.yourTurn ? (
            <button
              onClick={() => onMove({ type: "roll" })}
              disabled={busy}
              className="rounded-full bg-emerald-500 px-8 py-3 font-fun text-lg font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
            ><PlayfulText text={" 🎲 Roll the die "} /></button>
          ) : (
            <p className="font-round text-sm text-slate-400">Waiting for the roll…</p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-center font-round text-xs text-slate-400">
          {view.canBeat
            ? `Discard one or two cards that add up to at least ${view.die}.`
            : `You can't beat ${view.die} — draw a card.`}
        </p>
      )}

      {/* Hand */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {view.yourHand.map((card, idx) => {
          const on = picked.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => toggle(idx)}
              disabled={!rolled || !view.yourTurn || busy}
              className={`flex aspect-[3/4] w-14 items-center justify-center rounded-2xl font-fun text-2xl font-700 shadow-sm transition disabled:opacity-50 ${
                on ? "scale-[1.06] bg-emerald-500 text-white ring-2 ring-emerald-400" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:scale-[1.03]"
              }`}
            >
              {card}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={() => {
            if (canDiscard) {
              onMove({ type: "discard", cards: pickedValues });
              setPicked([]);
            }
          }}
          disabled={!canDiscard}
          className="rounded-full bg-coral px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-40"
        >
          Discard ✓{pickedValues.length > 0 ? ` (${sum})` : ""}
        </button>
        <button
          onClick={() => {
            onMove({ type: "draw" });
            setPicked([]);
          }}
          disabled={!canDraw}
          className="rounded-full bg-slate-100 px-6 py-2.5 font-fun font-700 text-slate-600 transition hover:bg-slate-200 disabled:opacity-40"
        ><PlayfulText text={" Draw 🃏 "} /></button>
      </div>
      {rolled && picked.length > 0 && !beats && (
        <p className="mt-2 text-center font-round text-xs text-coral">
          {sum} doesn&apos;t beat {view.die} yet.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card Showdown board (simultaneous secret play)                       */
/* ------------------------------------------------------------------ */
function ShowdownBoard({
  view,
  players,
  busy,
  onMove,
}: {
  view: ShowdownView;
  players: CardStateDTO["players"];
  busy: boolean;
  onMove: (m: unknown) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const open = view.yourSelection == null && !view.youEliminated;
  // Clear the selection the instant a new round's selection phase opens. Done
  // during render (not in an effect) so the cards never flash highlighted from
  // the previous round before an effect can wipe them.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setPicked([]);
  }
  // Safety: drop any index that no longer points at a card after a hand change.
  useEffect(() => {
    setPicked((p) => p.filter((i) => view.yourHand[i] != null).slice(0, 2));
  }, [view.yourHand]);

  const nameById = new Map(players.map((p) => [p.learnerId, p.name]));
  const name = (id: number) => nameById.get(id) ?? "Player";
  const committed = view.yourSelection != null;
  const pickedValues = picked.map((i) => view.yourHand[i]).filter((v) => v != null);
  const sum = pickedValues.reduce((a, b) => a + b, 0);
  const canPlay = !committed && !view.youEliminated && !busy && pickedValues.length >= 1 && pickedValues.length <= 2;
  const toggle = (idx: number) =>
    setPicked((p) => (p.includes(idx) ? p.filter((k) => k !== idx) : p.length >= 2 ? p : [...p, idx]));

  const r = view.lastResult;

  return (
    <div>
      {/* Scoreboard */}
      <div className="flex flex-wrap justify-center gap-2">
        {players.map((p) => {
          const out = view.eliminated.includes(p.learnerId);
          const s = view.stars[p.learnerId] ?? 0;
          return (
            <div
              key={p.learnerId}
              className={`rounded-2xl px-3 py-2 text-center font-fun ring-1 ${
                out ? "bg-slate-50 text-slate-300 ring-slate-100" : "bg-white text-slate-700 shadow-sm ring-slate-200"
              }`}
            >
              <div className="text-sm font-700">
                {p.avatar ?? "🙂"} {p.name}
                {out ? " ❌" : ""}
              </div>
              <div className="text-xs">
                <span className="text-amber-500">
                  {"⭐".repeat(s)}
                  {"☆".repeat(Math.max(0, view.starsToWin - s))}
                </span>{" "}
                <span className="text-slate-400"><PlayfulText text={"🃏 "} />{view.handCounts[p.learnerId] ?? 0}</span>
              </div>
              {!out && view.committed[p.learnerId] && (
                <div className="text-[10px] font-700 text-emerald-500">locked in</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Last round summary */}
      {r && (
        <div className="mt-3 rounded-2xl bg-bubble/10 px-4 py-2 text-center font-round text-xs text-slate-600 ring-1 ring-bubble/20">
          {r.draw ? (
            <><PlayfulText text={"🤝 Draw — everyone played the same total. No stars this round."} /></>
          ) : (
            <><PlayfulText text={" ⭐ "} />{r.highIds.map(name).join(" & ")}{" "}
              {r.highIds.length > 1 ? (
                <>
                  tied highest — each won a star and discarded; {r.lowIds.map(name).join(" & ")} took {r.transferred.join(" and ")}.
                </>
              ) : (
                <>
                  won with {r.transferred.join("+")} and gave {r.transferred.join(" and ")} to {r.lowIds.map(name).join(" & ")}, who discarded what they
                  played.
                </>
              )}
              {r.eliminatedThisRound.length > 0 && <> {r.eliminatedThisRound.map(name).join(", ")}<PlayfulText text={" ran out! ❌"} /></>}
            </>
          )}
        </div>
      )}

      {/* Your area */}
      {view.youEliminated ? (
        <p className="mt-6 text-center font-fun font-700 text-slate-400"><PlayfulText text={"You&apos;re out — watching the rest. 👀"} /></p>
      ) : committed ? (
        <div className="mt-6 text-center">
          <p className="font-fun font-700 text-emerald-600"><PlayfulText text={"✅ Locked in: "} />{view.yourSelection!.join(" + ")}</p>
          <p className="mt-1 font-round text-sm text-slate-400">
            Waiting for {view.waitingOn} more player{view.waitingOn === 1 ? "" : "s"}…
          </p>
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-center font-fun font-700 text-slate-700">Secretly play one or two cards</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {view.yourHand.map((card, idx) => {
              const on = picked.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggle(idx)}
                  disabled={busy}
                  className={`flex aspect-[3/4] w-14 items-center justify-center rounded-2xl font-fun text-2xl font-700 shadow-sm transition disabled:opacity-50 ${
                    on ? "scale-[1.06] bg-bubble text-white ring-2 ring-bubble/60" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:scale-[1.03]"
                  }`}
                >
                  {card}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                if (canPlay) onMove({ type: "play", cards: pickedValues });
              }}
              disabled={!canPlay}
              className="rounded-full bg-coral px-8 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-40"
            >
              Play{pickedValues.length > 0 ? ` (${sum})` : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matching Colours board (real-time reaction race)                    */
/* ------------------------------------------------------------------ */
function MatchColoursBoard({
  view,
  players,
  busy,
  onMove,
}: {
  view: MatchColoursView;
  players: CardStateDTO["players"];
  busy: boolean;
  onMove: (m: unknown) => void;
}) {
  // Correct the client clock to the server's so the reveal + countdown line up
  // for every player. Recompute only when a fresh poll lands (render-phase, like
  // the showdown selection reset — avoids a one-frame flash / effect lag).
  const [offset, setOffset] = useState(0);
  const lastServerNow = useRef<number | null>(null);
  if (lastServerNow.current !== view.serverNow) {
    lastServerNow.current = view.serverNow;
    setOffset(view.serverNow - Date.now());
  }
  // Re-render ~10×/s to drive the countdown and the shrinking timer bar locally.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 100);
    return () => clearInterval(id);
  }, []);

  const eff = Date.now() + offset;
  const answerMs = view.deadlineAt - view.revealAt;
  const correctColour = view.mapping[view.prompt - 1];
  const preview = !view.resolved && eff < view.revealAt;
  const result = view.resolved || eff >= view.deadlineAt;
  const answering = !preview && !result;
  const col = (i: number) => view.colours[i];

  return (
    <div>
      {/* Round header */}
      <div className="mb-3 text-center font-fun text-sm font-700 text-slate-500">
        {view.final ? `🏁 Sudden-death round ${view.round}` : `Round ${view.round} / ${view.roundsTotal}`}
      </div>

      {/* Scoreboard */}
      <div className="flex flex-wrap justify-center gap-2">
        {players.map((p) => {
          const inPool = view.pool.includes(p.learnerId);
          const pts = view.points?.[p.learnerId] ?? 0;
          return (
            <div
              key={p.learnerId}
              className={`rounded-2xl px-3 py-2 text-center font-fun ring-1 ${
                view.final && !inPool
                  ? "bg-slate-50 text-slate-300 ring-slate-100"
                  : "bg-white text-slate-700 shadow-sm ring-slate-200"
              }`}
            >
              <div className="text-sm font-700">
                {p.avatar ?? "🙂"} {p.name}
                {view.final && inPool ? " 🏁" : ""}
              </div>
              <div className="text-xs text-slate-500">
                <span className="font-700 text-slate-700 tabular-nums">{view.scores[p.learnerId] ?? 0}</span> pts
                {result && pts > 0 && <span className="ml-1 font-700 text-emerald-500">+{pts}</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage */}
      {!view.inRound ? (
        <p className="mt-8 text-center font-fun font-700 text-slate-400"><PlayfulText text={" 👀 Watching the sudden-death round… "} /></p>
      ) : preview ? (
        /* ---- Preview: memorise the colour↔number mapping ---- */
        <div className="mt-6">
          <div className="text-center font-fun text-lg font-700 text-slate-700">Memorise the colours!</div>
          <div className="mx-auto mt-4 grid max-w-md grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((num) => {
              const c = col(view.mapping[num - 1]);
              return (
                <div
                  key={num}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="font-fun text-3xl font-700 tabular-nums text-slate-800">{num}</div>
                  <div
                    className="flex h-12 w-full items-center justify-center rounded-xl font-fun text-sm font-700 text-white shadow-inner"
                    style={{ backgroundColor: c.hex }}
                  >
                    {c.emoji} {c.label}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 text-center">
            <div className="font-fun text-sm font-600 text-slate-400">Get ready…</div>
            <div className="font-fun text-6xl font-700 tabular-nums text-coral">
              {Math.max(1, Math.ceil((view.revealAt - eff) / 1000))}
            </div>
          </div>
        </div>
      ) : answering ? (
        /* ---- Answer: a number is called, race to tap the colour ---- */
        (() => {
          const youAnswered = view.yourAnswer != null;
          const frac = Math.max(0, Math.min(1, (view.deadlineAt - eff) / answerMs));
          return (
            <div className="mt-6">
              <div className="text-center">
                <div className="font-fun text-sm font-600 text-slate-400">Tap the colour for</div>
                <div className="font-fun text-7xl font-700 leading-none tabular-nums text-slate-900">
                  {view.prompt}
                </div>
              </div>
              <div className="mx-auto mt-4 h-2.5 max-w-sm overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-coral ease-linear"
                  style={{ width: `${frac * 100}%` }}
                />
              </div>
              {/* Reference strip: the number→colour mapping, so no memorising. */}
              <div className="mx-auto mt-4 flex max-w-sm flex-wrap justify-center gap-1.5">
                {[1, 2, 3, 4].map((num) => {
                  const c = col(view.mapping[num - 1]);
                  return (
                    <span
                      key={num}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 font-fun text-xs font-700 text-slate-600 shadow-sm ring-1 ring-slate-100"
                    >
                      <span className="tabular-nums">{num}</span>
                      <span
                        className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: c.hex }}
                      />
                    </span>
                  );
                })}
              </div>
              <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-3">
                {view.colours.map((c, i) => {
                  const chosen = view.yourAnswer === i;
                  return (
                    <button
                      key={c.key}
                      onClick={() => onMove({ type: "tap", colour: i })}
                      disabled={busy || youAnswered}
                      className={`flex h-20 items-center justify-center rounded-2xl font-fun text-lg font-700 text-white shadow transition disabled:cursor-default ${
                        chosen
                          ? "scale-[1.03] ring-4 ring-slate-800/30"
                          : youAnswered
                            ? "opacity-40"
                            : "hover:scale-[1.03]"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {c.emoji} {c.label}
                    </button>
                  );
                })}
              </div>
              {youAnswered && view.yourAnswer != null && view.yourAnswer >= 0 && (
                <p className="mt-4 text-center font-fun font-700 text-slate-500">
                  Locked in {col(view.yourAnswer).emoji} — waiting for the results…
                </p>
              )}
            </div>
          );
        })()
      ) : (
        /* ---- Result: reveal the correct colour + this round's points ---- */
        (() => {
          const cc = col(correctColour);
          const you = view.yourAnswer;
          const youCorrect = you === correctColour;
          const tallying = !view.resolved;
          return (
            <div className="mt-6 text-center">
              <div className="font-fun text-sm font-600 text-slate-400">Number {view.prompt} was</div>
              <div
                className="mx-auto mt-2 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-fun text-xl font-700 text-white shadow"
                style={{ backgroundColor: cc.hex }}
              >
                {cc.emoji} {cc.label}
              </div>
              <div className="mt-4 font-fun font-700">
                {you == null || you < 0 ? (
                  <span className="text-slate-400"><PlayfulText text={"⏳ Too slow — no points."} /></span>
                ) : youCorrect ? (
                  <span className="text-emerald-600"><PlayfulText text={" ✅ Correct!"} />{!tallying && view.yourPoints ? ` +${view.yourPoints}` : ""}
                    {!tallying && view.yourPoints === 3 ? " ⚡ Fastest!" : ""}
                  </span>
                ) : (
                  <span className="text-coral"><PlayfulText text={"❌ You tapped "} />{col(you).emoji} — no points.</span>
                )}
              </div>
              {tallying && <div className="mt-1 font-round text-xs text-slate-400">Tallying scores…</div>}
            </div>
          );
        })()
      )}
    </div>
  );
}

/* ---- Shared hand strip (discard game) ---- */
function Hand({
  cards,
  selectedIndex,
  onToggle,
  disabled,
}: {
  cards: number[];
  selectedIndex: number | null;
  onToggle: (idx: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {cards.map((card, idx) => {
        const on = idx === selectedIndex;
        return (
          <button
            key={idx}
            onClick={() => onToggle(idx)}
            disabled={disabled}
            className={`flex aspect-[3/4] w-12 items-center justify-center rounded-xl font-fun text-xl font-700 shadow-sm transition disabled:opacity-50 ${
              on ? "scale-[1.08] bg-coral text-white ring-2 ring-coral/60" : "bg-white text-slate-800 ring-1 ring-slate-200 hover:scale-[1.04]"
            }`}
          >
            {card}
          </button>
        );
      })}
    </div>
  );
}
