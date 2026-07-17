"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LEVELS,
  STEPS,
  STEP_GLYPH,
  expand,
  moveCount,
  sameCell,
  step as stepCell,
  type Cell,
  type Instr,
  type Level,
  type Step,
} from "@/lib/code-puzzles";

/** One step of the runner, matching the Android screen's 0.4s cadence. */
const TICK_MS = 400;

export function CodeQuestGame({ initialCleared }: { initialCleared: number[] }) {
  // Seeded from this learner's own completions (see page.tsx) — never from the
  // browser, which is shared between kids.
  const [cleared, setCleared] = useState<number[]>(initialCleared);
  // null = the level-select list is showing; otherwise the chosen level plays.
  const [selected, setSelected] = useState<number | null>(null);

  const markCleared = useCallback((index: number) => {
    // Unlock immediately so the next level opens even if the save below fails;
    // the server is still the source of truth on the next visit.
    setCleared((prev) => (prev.includes(index) ? prev : [...prev, index]));
    fetch("/api/learn/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activitySlug: "ai-coding",
        score: 100,
        metadata: { level: index + 1 },
      }),
    }).catch(() => {});
  }, []);

  // A level is unlocked once the previous one has been cleared (the first is
  // always open). Cleared levels stay unlocked forever.
  const isUnlocked = (index: number) => index === 0 || cleared.includes(index - 1);

  if (selected == null) {
    return <LevelSelect cleared={cleared} isUnlocked={isUnlocked} onPick={setSelected} />;
  }

  return (
    <LevelPlay
      key={selected}
      levelIndex={selected}
      onExit={() => setSelected(null)}
      onCleared={() => markCleared(selected)}
      onNext={() => setSelected(selected + 1 < LEVELS.length ? selected + 1 : null)}
    />
  );
}

/** The level picker: cleared levels starred, locked ones behind a padlock until
 *  the prior level is solved. */
function LevelSelect({
  cleared,
  isUnlocked,
  onPick,
}: {
  cleared: number[];
  isUnlocked: (index: number) => boolean;
  onPick: (index: number) => void;
}) {
  return (
    <div>
      <div className="rounded-[2rem] bg-gradient-to-r from-grape/30 to-sky/30 p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 text-3xl">💻</div>
          <div>
            <h1 className="font-fun text-2xl font-700 text-slate-900">Code Quest</h1>
            <p className="font-round text-slate-600">
              Plan the robot&apos;s path to the star — then press Run! 🤖
            </p>
          </div>
        </div>
      </div>

      <h2 className="mt-8 font-fun text-xl font-700 text-slate-900">Pick a level</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map((level, i) => {
          const unlocked = isUnlocked(i);
          const done = cleared.includes(i);
          return (
            <button
              key={i}
              onClick={() => unlocked && onPick(i)}
              disabled={!unlocked}
              className={`flex items-center gap-4 rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-slate-100 transition ${
                unlocked ? "hover:-translate-y-0.5 hover:shadow-md" : "opacity-60"
              }`}
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl font-fun text-2xl font-700 ${
                  done ? "bg-mint/20 text-emerald-600" : unlocked ? "bg-grape/15 text-grape" : "bg-slate-100"
                }`}
              >
                {unlocked ? i + 1 : "🔒"}
              </div>
              <div className="flex-1">
                <div className={`font-fun font-700 ${unlocked ? "text-slate-900" : "text-slate-400"}`}>
                  Level {i + 1} {done && "⭐"}
                </div>
                <div className="font-round text-sm text-slate-500">
                  {unlocked
                    ? `${level.size}×${level.size} grid • up to ${level.maxMoves} steps`
                    : "Clear the level before to unlock"}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A single playable level. */
function LevelPlay({
  levelIndex,
  onExit,
  onCleared,
  onNext,
}: {
  levelIndex: number;
  onExit: () => void;
  onCleared: () => void;
  onNext: () => void;
}) {
  const level = LEVELS[levelIndex];

  const [program, setProgram] = useState<Instr[]>([]);
  // null = normal mode. Non-null = a loop is open; arrows drop into this buffer.
  const [openLoop, setOpenLoop] = useState<Step[] | null>(null);
  const [loopTimes, setLoopTimes] = useState(2); // ×N for the open loop, 2..4
  const [robot, setRobot] = useState<Cell>(level.start);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Plan the robot's path to the star!");
  const [celebrate, setCelebrate] = useState(false);

  // Held in a ref so the runner below re-runs only when a run actually starts —
  // not whenever the parent hands down a fresh callback identity.
  const onClearedRef = useRef(onCleared);
  onClearedRef.current = onCleared;

  // Drive the robot along the planned program, one step every 0.4s.
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    (async () => {
      let pos: Cell = level.start;
      setRobot(pos);
      for (const dir of expand(program)) {
        await sleep(TICK_MS);
        if (cancelled) return;
        pos = stepCell(level, pos, dir); // clamps to the grid, refuses walls
        setRobot(pos);
      }
      await sleep(TICK_MS);
      if (cancelled) return;
      setRunning(false);
      if (sameCell(pos, level.goal)) {
        onClearedRef.current();
        setCelebrate(true);
      } else {
        // Keep the plan so the child can debug it — tweak or Undo the last step
        // and Run again — rather than re-entering everything. Just snap the
        // robot back to the start ready for the next attempt.
        setMessage("Almost! Tweak your steps and Run again. 🔁");
        await sleep(TICK_MS);
        if (!cancelled) setRobot(level.start);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [running, level, program]);

  const wouldExceed = () => {
    const projected =
      openLoop != null
        ? moveCount(program) + (openLoop.length + 1) * loopTimes
        : moveCount(program) + 1;
    return projected > level.maxMoves;
  };

  const onStep = (s: Step) => {
    if (running) return;
    if (wouldExceed()) {
      setMessage("You cannot add any more steps!");
      return;
    }
    if (openLoop != null) setOpenLoop([...openLoop, s]);
    else setProgram([...program, { kind: "move", step: s }]);
  };

  // Close the loop: commit it (if it has a body), else cancel.
  const onDone = () => {
    if (running) return;
    if (openLoop && openLoop.length > 0) {
      setProgram([...program, { kind: "loop", body: openLoop, times: loopTimes }]);
    }
    setOpenLoop(null);
  };

  // Enter bracket mode: start an empty loop body.
  const onRepeat = () => {
    if (running || openLoop != null) return;
    setOpenLoop([]);
    setLoopTimes(2);
  };

  const onUndo = () => {
    if (running) return;
    if (openLoop != null && openLoop.length > 0) setOpenLoop(openLoop.slice(0, -1));
    else if (openLoop != null) setOpenLoop(null); // cancel empty loop
    else if (program.length > 0) setProgram(program.slice(0, -1));
  };

  // Block Run while a loop is still open — force them to close it first.
  const onRun = () => {
    if (openLoop != null) setMessage("Tap Done to finish your loop first.");
    else if (!running && program.length > 0) setRunning(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onExit}
          className="rounded-full bg-slate-100 px-5 py-2.5 font-fun font-700 text-slate-600 transition hover:bg-slate-200"
        >
          ← Levels
        </button>
        <h1 className="font-fun text-xl font-700 text-slate-900">
          Code Quest • Level {levelIndex + 1}
        </h1>
        <span className="rounded-full bg-white px-3 py-1 font-fun text-xs font-700 text-slate-500 ring-1 ring-slate-100">
          Steps {moveCount(program)} / {level.maxMoves}
        </span>
      </div>

      <p className="mt-5 text-center font-round text-lg font-600 text-slate-600">{message}</p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start lg:justify-center">
        <div className="flex justify-center">
          <Grid level={level} robot={robot} />
        </div>

        <div className="flex flex-col items-center gap-5">
          <ProgramBar program={program} openLoop={openLoop} loopTimes={loopTimes} />
          <Controls
            running={running}
            inLoop={openLoop != null}
            loopTimes={loopTimes}
            onStep={onStep}
            onUndo={onUndo}
            onRun={onRun}
            onRepeat={onRepeat}
            onDone={onDone}
            onTimes={setLoopTimes}
          />
        </div>
      </div>

      {celebrate && (
        <Celebration
          isLast={levelIndex + 1 >= LEVELS.length}
          onNext={() => {
            setCelebrate(false);
            onNext();
          }}
        />
      )}
    </div>
  );
}

function Grid({ level, robot }: { level: Level; robot: Cell }) {
  // Rows render top-down, but y points up — so walk size-1 → 0.
  const rows = Array.from({ length: level.size }, (_, i) => level.size - 1 - i);
  const cols = Array.from({ length: level.size }, (_, i) => i);
  return (
    <div className="inline-flex flex-col gap-1.5 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
      {rows.map((y) => (
        <div key={y} className="flex gap-1.5">
          {cols.map((x) => {
            const cell: Cell = [x, y];
            const isWall = level.walls.some((w) => sameCell(w, cell));
            return (
              <div
                key={x}
                className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl sm:h-14 sm:w-14 sm:text-3xl ${
                  isWall ? "bg-slate-700" : "bg-sky/10"
                }`}
              >
                {sameCell(level.goal, cell) && <span aria-hidden>⭐</span>}
                {sameCell(robot, cell) && <span aria-hidden>🤖</span>}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ProgramBar({
  program,
  openLoop,
  loopTimes,
}: {
  program: Instr[];
  openLoop: Step[] | null;
  loopTimes: number;
}) {
  const empty = program.length === 0 && openLoop == null;
  return (
    <div className="flex min-h-[4.5rem] w-full flex-wrap items-center gap-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      {empty ? (
        <span className="font-round text-slate-400">Your steps appear here</span>
      ) : (
        <>
          {program.map((instr, i) =>
            instr.kind === "move" ? (
              <MoveTile key={i} step={instr.step} />
            ) : (
              <LoopTile key={i} body={instr.body} times={instr.times} tone="grape" />
            ),
          )}
          {/* The loop currently being built, highlighted as "in progress" so it's
              clear where new arrows are landing. */}
          {openLoop != null && <LoopTile body={openLoop} times={loopTimes} tone="tangerine" />}
        </>
      )}
    </div>
  );
}

/** A single move as a rounded glyph tile. */
function MoveTile({ step }: { step: Step }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500 font-fun text-xl font-700 text-white">
      {STEP_GLYPH[step]}
    </span>
  );
}

/** A loop as a bracketed container: its body moves in a row plus a ×N badge. An
 *  empty body (a loop still being built) shows an ellipsis. */
function LoopTile({ body, times, tone }: { body: Step[]; times: number; tone: "grape" | "tangerine" }) {
  const skin =
    tone === "grape"
      ? { wrap: "bg-grape/15", badge: "bg-grape", dots: "text-grape" }
      : { wrap: "bg-tangerine/20", badge: "bg-tangerine", dots: "text-orange-600" };
  return (
    <span className={`flex items-center gap-1.5 rounded-2xl px-2 py-1.5 ${skin.wrap}`}>
      {body.length === 0 ? (
        <span className={`px-1 font-fun text-xl font-700 ${skin.dots}`}>…</span>
      ) : (
        body.map((s, i) => <MoveTile key={i} step={s} />)
      )}
      <span className={`rounded-lg px-2 py-1 font-fun text-sm font-700 text-white ${skin.badge}`}>
        ×{times}
      </span>
    </span>
  );
}

function Controls({
  running,
  inLoop,
  loopTimes,
  onStep,
  onUndo,
  onRun,
  onRepeat,
  onDone,
  onTimes,
}: {
  running: boolean;
  inLoop: boolean;
  loopTimes: number;
  onStep: (s: Step) => void;
  onUndo: () => void;
  onRun: () => void;
  onRepeat: () => void;
  onDone: () => void;
  onTimes: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-3">
        {STEPS.map((s) => (
          <button
            key={s}
            onClick={() => onStep(s)}
            disabled={running}
            aria-label={s}
            className="h-14 w-14 rounded-full bg-sky-500 font-fun text-2xl font-700 text-white shadow transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {STEP_GLYPH[s]}
          </button>
        ))}
      </div>

      {/* While a loop is open, offer ×2/×3/×4 chips for its repeat count. */}
      {inLoop && (
        <div className="flex gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => onTimes(n)}
              disabled={running}
              className={`h-11 w-11 rounded-full font-fun font-700 transition ${
                n === loopTimes ? "bg-tangerine text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              ×{n}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        {inLoop ? (
          <button
            onClick={onDone}
            disabled={running}
            className="rounded-full bg-mint px-6 py-3 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
          >
            ✓ Done
          </button>
        ) : (
          <button
            onClick={onRepeat}
            disabled={running}
            className="rounded-full bg-grape px-6 py-3 font-fun font-700 text-white shadow transition hover:scale-105 disabled:opacity-50"
          >
            🔁 Repeat
          </button>
        )}
        <button
          onClick={onUndo}
          disabled={running}
          className="rounded-full bg-slate-100 px-6 py-3 font-fun font-700 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
        >
          ↩ Undo
        </button>
      </div>

      <button
        onClick={onRun}
        disabled={running}
        className="rounded-full bg-coral px-10 py-3.5 font-fun text-lg font-700 text-white shadow transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
      >
        {running ? "Running…" : "▶ Run"}
      </button>
    </div>
  );
}

function Celebration({ isLast, onNext }: { isLast: boolean; onNext: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-lg ring-1 ring-slate-100">
        <div className="text-6xl">🤖⭐</div>
        <h2 className="mt-4 font-fun text-2xl font-700 text-slate-900">Solved it!</h2>
        <p className="mt-1 font-round text-slate-500">
          {isLast ? "You finished every puzzle. Amazing! 🎉" : "Nice planning. On to the next one!"}
        </p>
        <button
          onClick={onNext}
          className="mt-6 w-full rounded-full bg-coral px-6 py-3 font-fun font-700 text-white shadow transition hover:scale-105"
        >
          {isLast ? "Back to levels" : "Next level →"}
        </button>
        <Link
          href="/learn"
          className="mt-3 block font-fun text-sm font-700 text-slate-400 hover:text-coral"
        >
          Back to activities
        </Link>
      </div>
    </div>
  );
}
