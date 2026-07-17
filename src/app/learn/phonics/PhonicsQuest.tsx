"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  PHONEME_SLUGS,
  PHONICS_STAGES,
  slugForTeam,
  stageRounds,
  starsForMistakes,
  type AccentKey,
  type PhonicsStage,
  type PopRound,
  type BuildRound,
  type RhymeRound,
  type ListenRound,
  type BlendRound,
  type DigraphRound,
} from "@/lib/phonics/content";

/* ---- Per-world accent classes (literal so Tailwind keeps them) ---- */
const ACCENTS: Record<AccentKey, { solid: string; text: string; soft: string; ring: string; softText: string }> = {
  bubble: { solid: "bg-bubble", text: "text-bubble", soft: "bg-bubble/15", ring: "ring-bubble/30", softText: "text-bubble" },
  tangerine: { solid: "bg-tangerine", text: "text-orange-600", soft: "bg-tangerine/15", ring: "ring-tangerine/30", softText: "text-orange-600" },
  grape: { solid: "bg-grape", text: "text-grape", soft: "bg-grape/15", ring: "ring-grape/30", softText: "text-grape" },
  mint: { solid: "bg-mint", text: "text-emerald-600", soft: "bg-mint/15", ring: "ring-mint/30", softText: "text-emerald-600" },
  sky: { solid: "bg-sky-500", text: "text-sky-600", soft: "bg-sky-100", ring: "ring-sky-200", softText: "text-sky-600" },
  teal: { solid: "bg-teal-500", text: "text-teal-600", soft: "bg-teal-100", ring: "ring-teal-200", softText: "text-teal-600" },
};

/* ---- Speech (browser, offline) — for whole words only ---- */
function useSpeaker() {
  return useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.8;
    u.pitch = 1.2;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);
}

/**
 * Plays a pre-recorded phoneme clip by slug (e.g. `v_a_short` for /æ/).
 *
 * Isolated sounds can't go through SpeechSynthesis — it reads text *as words*,
 * so "ah" ≠ /æ/. These clips were generated once from cloud TTS with correct
 * SSML `<phoneme>` pronunciation (see the Android repo's `tools/phoneme-tts/`)
 * and are served statically.
 *
 * Every clip is fetched and decoded once on mount, then replayed from the cache.
 * The clips are ~0.9s and the blend sequences move on after a fixed gap (650ms),
 * so anything a clip spends loading is lost off the front of the sound — build it
 * fresh per play and the child hears a clipped phoneme. Android gets this free by
 * playing out of the APK; on the web it has to be warmed.
 *
 * Resolves when the sound actually finishes, so a caller can time a pause from the
 * silence rather than from the `play()` call — a fixed `sleep` shorter than the
 * clip elapses while it's still sounding and the pause never happens.
 */

/** Phonemes play a touch under real-time so a young child can catch each sound.
 *  Pitch is preserved (see `preservesPitch` below), so it slows without dropping
 *  the sound low. 1 = the raw recording; lower = slower. Tune here. */
const PHONEME_RATE = 0.67;

function usePhonemePlayer() {
  const cache = useRef<Map<string, HTMLAudioElement>>(new Map());
  const current = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const loaded = cache.current;
    for (const slug of PHONEME_SLUGS) {
      const audio = new Audio(`/phonics/phonemes/${slug}.mp3`);
      audio.preload = "auto";
      audio.load();
      loaded.set(slug, audio);
    }
    return () => {
      current.current?.pause();
      current.current = null;
      loaded.clear();
    };
  }, []);

  const play = useCallback((slug: string): Promise<void> => {
    if (!slug) return Promise.resolve(); // silent letter (or unknown team) — play nothing
    let audio = cache.current.get(slug);
    if (!audio) {
      audio = new Audio(`/phonics/phonemes/${slug}.mp3`);
      cache.current.set(slug, audio);
    }
    const clip = audio;
    // Silence any in-flight TTS word first. The recorded phoneme and the browser
    // voice are separate channels: left alone they overlap (desktop) or the voice
    // ducks the clip (tablets), so the same clean sound comes out muddied and
    // clipped in the worlds that speak the word a lot (e.g. Letters Land). Killing
    // speech here makes a phoneme play identically — clean and full — everywhere.
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    current.current?.pause(); // stop whatever was sounding (resolves its promise)
    current.current = clip;
    clip.currentTime = 0; // a cached clip would otherwise resume where it was paused
    clip.playbackRate = PHONEME_RATE;
    // Keep the pitch of the recording while slowing it — without this the vowel
    // drops low and muddy. `preservesPitch` is standard; the vendor props cover
    // older Safari/Firefox.
    const c = clip as HTMLAudioElement & { mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
    c.preservesPitch = true;
    c.mozPreservesPitch = true;
    c.webkitPreservesPitch = true;
    return new Promise<void>((resolve) => {
      // "pause" covers being superseded by the next sound, "error" a bad decode —
      // without them a stalled clip would hang the sequence awaiting it.
      const done = () => {
        for (const e of ["ended", "pause", "error"]) clip.removeEventListener(e, done);
        resolve();
      };
      for (const e of ["ended", "pause", "error"]) clip.addEventListener(e, done);
      void clip.play().catch(done); // autoplay blocked — degrade silently, never throw
    });
  }, []);

  // Cut everything now: pause the current clip and kill any spoken word. Used when
  // the child leaves a round mid-sound-out, so nothing bleeds into the next.
  const stop = useCallback(() => {
    current.current?.pause();
    current.current = null;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  return { play, stop };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Silence held after the last letter finishes, before the word is blended — it
 *  separates "that was the last sound" from "now here's the whole word". Timed
 *  from the end of the clip, so it is real silence. */
const BLEND_LEAD_IN = 600;
/** Silence *between* sounds in a sound-out, held AFTER each clip has fully played
 *  (the loop awaits `play`, which resolves on `ended`). Timing from the clip's end
 *  rather than a fixed gap keeps the cadence smooth at any `PHONEME_RATE` — a fixed
 *  gap shorter than a slowed clip chops each sound off partway and sounds choppy. */
const BLEND_SOUND_GAP = 50;

/**
 * Runs timed sound sequences (sounding out a word, blending it) that cancel when
 * the round changes or the game unmounts — otherwise a stale blend keeps playing
 * over the next round. `run` hands the task an `alive()` it must check between
 * steps; a newer `run` (or unmount) makes every older task's `alive()` false.
 */
function useSequencer() {
  const gen = useRef(0);
  useEffect(
    () => () => {
      gen.current += 1;
    },
    [],
  );
  const run = useCallback((task: (alive: () => boolean) => Promise<void>) => {
    gen.current += 1;
    const mine = gen.current;
    void task(() => gen.current === mine);
  }, []);
  // Invalidate the running task without starting a new one — lets a caller stop a
  // sound-out (e.g. when the child taps Next mid-sequence).
  const cancel = useCallback(() => {
    gen.current += 1;
  }, []);
  return { run, cancel };
}

/* ---- Progress (best stars per world), keyed by world id. Seeded from this
   learner's own completions in page.tsx — never from the browser, which kids
   share; a device-wide tally hands one kid another's unlocks. ---- */
export type Stars = Record<string, number>;

/* ---- Small shared bits ---- */
function StarRow({ filled, size = "text-xl" }: { filled: number; size?: string }) {
  return (
    <div className={`flex ${size}`}>
      {[0, 1, 2].map((s) => (
        <span key={s} className={s < filled ? "" : "opacity-25 grayscale"}>
          ⭐
        </span>
      ))}
    </div>
  );
}

function HearButton({ onClick, accent, label = "Hear it" }: { onClick: () => void; accent: AccentKey; label?: string }) {
  const a = ACCENTS[accent];
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-fun text-sm font-700 shadow-sm ring-1 ring-slate-100 ${a.softText}`}
    >
      🔊 {label}
    </button>
  );
}

function RoundFeedback({ solved, wrong, isLast, accent, onNext }: { solved: boolean; wrong: boolean; isLast: boolean; accent: AccentKey; onNext: () => void }) {
  const a = ACCENTS[accent];
  if (solved) {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="font-fun text-lg font-700 text-emerald-600">Great job! 🎉</p>
        <button onClick={onNext} className={`rounded-full ${a.solid} px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105`}>
          {isLast ? "Finish ▶" : "Next ▶"}
        </button>
      </div>
    );
  }
  if (wrong) {
    return <p className="text-center font-round font-600 text-coral">Not quite — listen again and try once more! 🙂</p>;
  }
  return null;
}

/**
 * A pickable answer card with its own "hear" speaker. The WHOLE card is the tap
 * target (a small inner button is easy to miss — you end up tapping the padding
 * and nothing happens), so it's a `role="button"`; the speaker stops propagation
 * so hearing a choice doesn't also pick it. `active:scale-95` gives a tap a bit of
 * feedback on touch.
 */
function TapCard({
  wrong,
  onPick,
  onHear,
  hearLabel,
  accent,
  width = "w-28",
  children,
}: {
  wrong: boolean;
  onPick: () => void;
  onHear: () => void;
  hearLabel: string;
  accent: AccentKey;
  width?: string;
  children: ReactNode;
}) {
  const a = ACCENTS[accent];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      className={`flex ${width} cursor-pointer select-none flex-col items-center gap-1.5 rounded-3xl p-4 shadow-sm ring-1 transition active:scale-95 ${
        wrong ? "bg-coral/15 ring-coral/30" : "bg-white ring-slate-100"
      }`}
    >
      {children}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onHear();
        }}
        aria-label={hearLabel}
        className={`rounded-full ${a.soft} px-3 py-1 font-fun text-xs font-700 ${a.softText}`}
      >
        🔊
      </button>
    </div>
  );
}

/* ---- Optional AI "Buddy" (hints only) ---- */
type BuddyReq =
  | { type: "hint"; game: "pop"; word: string; letter: string }
  | { type: "hint"; game: "build" | "listen" | "blend"; word: string }
  | { type: "hint"; game: "rhyme"; word: string; answer: string }
  | { type: "hint"; game: "digraph"; word: string; team: string };

/** How long to wait for the AI hint before showing a generic one instead. The
 *  Buddy is usually ~1s, but a rate-limited Gemini falls back to the Agent SDK
 *  (6-24s) — a child shouldn't sit watching "Thinking…" that long. */
const HINT_TIMEOUT = 3500;

/** A canned, answer-safe hint per game, used when the AI Buddy is too slow or
 *  errors. Never names a specific word, so it can't give a round away. */
function genericHint(req: BuddyReq): string {
  switch (req.game) {
    case "pop":
      return "Say the word slowly and listen to its very first sound!";
    case "build":
      return "Sound out each letter, then push them together!";
    case "rhyme":
      return "Listen to the ending sound and find one that matches!";
    case "listen":
      return "Listen carefully and pick the word that sounds just right!";
    case "blend":
      return "Blend the sounds together slowly to hear the word!";
    case "digraph":
      return "Two letters can team up to make one brand-new sound!";
  }
}

function PhonicsBuddy({ enabled, req, accent, speak, resetKey }: { enabled: boolean; req: BuddyReq; accent: AccentKey; speak: (t: string) => void; resetKey: string }) {
  const a = ACCENTS[accent];
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setHint(null);
  }, [resetKey]);
  if (!enabled) return null;
  async function ask() {
    setBusy(true);
    // Race the AI hint against a timeout: whichever lands first wins, and `settled`
    // makes sure the loser never speaks over it.
    let settled = false;
    const show = (msg: string) => {
      if (settled) return;
      settled = true;
      setHint(msg);
      speak(msg);
      setBusy(false);
    };
    const timer = setTimeout(() => show(genericHint(req)), HINT_TIMEOUT);
    try {
      const res = await fetch("/api/learn/phonics-buddy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const d = await res.json();
      clearTimeout(timer);
      show((d.message as string | null) ?? genericHint(req));
    } catch {
      clearTimeout(timer);
      show(genericHint(req));
    }
  }
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <button
        onClick={ask}
        disabled={busy}
        className={`inline-flex items-center gap-2 rounded-full ${a.solid} px-5 py-2 font-fun text-sm font-700 text-white shadow transition hover:scale-105 disabled:opacity-60`}
      >
        ✨ {busy ? "Thinking…" : "Ask Buddy"}
      </button>
      {hint && <p className={`w-full rounded-2xl ${a.soft} p-3 text-center font-round text-sm text-slate-700`}>🤖 {hint}</p>}
    </div>
  );
}

/* ============================ Mini-games ============================ */

function PopGame({ rounds, accent, speak, play, buddy, onProgress, onFinish }: GameProps<PopRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const round = rounds[index];
  const options = useMemo(() => [...round.options].sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    const t = setTimeout(() => speak(round.word), 250);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(i: number) {
    if (wrong != null || solved) return;
    if (options[i] === round.answer) setSolved(true);
    else {
      setWrong(i);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <div className="text-7xl">{round.emoji}</div>
        <div className="font-fun text-2xl font-700 text-slate-900">{round.word}</div>
        <HearButton onClick={() => speak(round.word)} accent={accent} />
      </div>
      <p className="text-center font-round font-600 text-slate-500">Hear each sound, then pick the one it starts with!</p>
      {/* The letter is hidden, so the choice is made by ear. */}
      <div className="flex justify-center gap-3">
        {options.map((slug, i) => (
          <div key={i} className={`flex w-24 flex-col items-center gap-2 rounded-3xl p-3 shadow-sm ring-1 ${wrong === i ? "bg-coral/15 ring-coral/30" : "bg-white ring-slate-100"}`}>
            <div className={`font-fun text-3xl font-700 ${a.text}`}>{i + 1}</div>
            <button onClick={() => play(slug)} className={`rounded-full ${a.soft} px-3 py-1.5 font-fun text-xs font-700 ${a.softText}`}>
              🔊 Hear
            </button>
            <button onClick={() => pick(i)} className={`w-full rounded-xl ${a.solid} py-1.5 font-fun text-sm font-700 text-white`}>
              Pick
            </button>
          </div>
        ))}
      </div>
      <RoundFeedback solved={solved} wrong={wrong != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && <PhonicsBuddy enabled resetKey={`pop-${round.word}`} req={{ type: "hint", game: "pop", word: round.word, letter: round.letter }} accent={accent} speak={speak} />}
    </div>
  );
}

function BuildGame({ rounds, accent, speak, play, stop, buddy, onProgress, onFinish }: GameProps<BuildRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [solved, setSolved] = useState(false);
  const [used, setUsed] = useState<number[]>([]);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  // The tile tapped once — armed so a child can hear it, then tap again to place.
  const [pending, setPending] = useState<number | null>(null);
  const round = rounds[index];
  const target = round.word;
  const tiles = useMemo(() => [...target].sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const builtLen = used.length;
  const isLast = index + 1 >= rounds.length;
  const { run: runSequence, cancel: cancelSequence } = useSequencer();

  // The sound this letter makes in THIS word (silent letters map to "" → no
  // sound). Keyed by position so e.g. the C in CASTLE is /k/, not the /s/ of C.
  const soundForLetter = (ch: string) => round.sounds[target.indexOf(ch)] ?? "";

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    setUsed([]);
    setPending(null);
    const t = setTimeout(() => speak(round.word), 250);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrongTile == null) return;
    const t = setTimeout(() => setWrongTile(null), 500);
    return () => clearTimeout(t);
  }, [wrongTile]);
  // Leaving the stage mid-sound-out: cut the audio so it doesn't play on after.
  useEffect(() => () => stop(), [stop]);

  // Advance (or finish), stopping the completion sound-out first so it can't bleed
  // into the next round — the child chose to move on.
  function goNext() {
    cancelSequence();
    stop();
    if (isLast) onFinish(mistakes);
    else setIndex(index + 1);
  }

  function tap(i: number, ch: string) {
    if (used.includes(i) || wrongTile != null || solved) return;
    // First tap: hear the letter's sound and arm the tile — don't place or judge
    // yet, so a child can listen before committing. (A silent letter plays no
    // sound, but the tile still highlights, so the tap doesn't feel ignored.)
    if (pending !== i) {
      setPending(i);
      play(soundForLetter(ch));
      return;
    }
    // Second tap on the armed tile: place it.
    setPending(null);
    if (ch !== target[builtLen]) {
      setWrongTile(i);
      setMistakes((m) => m + 1);
      return;
    }
    const next = [...used, i];
    setUsed(next);
    // Already heard on the first tap — don't replay the individual sound.
    const landed = round.sounds[builtLen] ?? "";
    if (next.length < target.length) return;
    setSolved(true);
    runSequence(async (alive) => {
      // Let the final letter finish sounding, then hold a beat of real silence, so
      // the child hears "that's the last letter" and "now the whole word" as two
      // separate things rather than one run-on stream.
      await play(landed);
      if (!alive()) return;
      await sleep(BLEND_LEAD_IN);
      // Sound out the whole word: each sound fully, in order, then the word itself.
      for (const slug of round.sounds) {
        if (!slug) continue;
        if (!alive()) return;
        await play(slug);
        if (!alive()) return;
        await sleep(BLEND_SOUND_GAP);
      }
      if (!alive()) return;
      await sleep(150);
      speak(target);
    });
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="font-round font-600 text-slate-500">{pending != null ? "Tap it again to place it! 👆" : "Tap a letter to hear it"}</p>
      <div className={`flex w-full flex-col items-center gap-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <div className="text-6xl">{round.emoji}</div>
        <HearButton onClick={() => speak(round.word)} accent={accent} />
        <div className="flex gap-2">
          {[...target].map((ch, i) => (
            <div key={i} className={`flex h-12 w-12 items-center justify-center rounded-xl font-fun text-2xl font-700 ${i < builtLen ? `${a.soft} ${a.softText}` : "bg-slate-100 text-transparent"}`}>
              {i < builtLen ? ch : "•"}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {tiles.map((ch, i) => {
          const isUsed = used.includes(i);
          return (
            <button
              key={i}
              onClick={() => tap(i, ch)}
              disabled={isUsed}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl font-fun text-2xl font-700 shadow-sm ring-1 transition ${
                wrongTile === i
                  ? "bg-coral text-white ring-coral"
                  : pending === i
                    ? `${a.soft} ${a.softText} scale-110 ring-2 ${a.ring}`
                    : isUsed
                      ? "bg-slate-50 text-slate-300 ring-slate-100"
                      : "bg-white text-slate-800 ring-slate-100 hover:scale-105"
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>
      <RoundFeedback solved={solved} wrong={wrongTile != null} isLast={isLast} accent={accent} onNext={goNext} />
      {buddy && <PhonicsBuddy enabled resetKey={`build-${target}`} req={{ type: "hint", game: "build", word: target }} accent={accent} speak={speak} />}
    </div>
  );
}

function RhymeGame({ rounds, accent, speak, buddy, onProgress, onFinish }: GameProps<RhymeRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const round = rounds[index];
  const order = useMemo(() => round.options.map((_, i) => i).sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    const t = setTimeout(() => speak(round.word), 250);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(orig: number) {
    if (wrong != null || solved) return;
    if (orig === round.answerIndex) {
      speak(round.options[orig].word);
      setSolved(true);
    } else {
      setWrong(orig);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="font-round font-600 text-slate-500">Which word rhymes?</p>
      <div className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <div className="text-6xl">{round.emoji}</div>
        <div className="font-fun text-2xl font-700 text-slate-900">{round.word}</div>
        <HearButton onClick={() => speak(round.word)} accent={accent} />
      </div>
      <div className="flex justify-center gap-3">
        {order.map((orig) => {
          const opt = round.options[orig];
          return (
            <TapCard key={orig} wrong={wrong === orig} onPick={() => pick(orig)} onHear={() => speak(opt.word)} hearLabel={`Hear ${opt.word}`} accent={accent}>
              <span className="text-4xl">{opt.emoji}</span>
              <span className="font-fun text-sm font-700 text-slate-700">{opt.word}</span>
            </TapCard>
          );
        })}
      </div>
      <RoundFeedback solved={solved} wrong={wrong != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && (
        <PhonicsBuddy
          enabled
          resetKey={`rhyme-${round.word}`}
          req={{ type: "hint", game: "rhyme", word: round.word, answer: round.options[round.answerIndex].word }}
          accent={accent}
          speak={speak}
        />
      )}
    </div>
  );
}

function ListenGame({ rounds, accent, speak, buddy, onProgress, onFinish }: GameProps<ListenRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const round = rounds[index];
  const order = useMemo(() => round.options.map((_, i) => i).sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    const t = setTimeout(() => speak(round.word), 300);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(orig: number) {
    if (wrong != null || solved) return;
    if (orig === round.answerIndex) {
      speak(round.options[orig]);
      setSolved(true);
    } else {
      setWrong(orig);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="text-center font-round font-600 text-slate-500">Listen, then tap the word you hear!</p>
      <div className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <button onClick={() => speak(round.word)} className={`flex h-24 w-24 items-center justify-center rounded-full ${a.solid} text-5xl text-white shadow-lg transition hover:scale-105`}>
          🔊
        </button>
        <p className="font-round text-sm font-600 text-slate-400">Tap to hear again</p>
      </div>
      <div className="flex justify-center gap-3">
        {order.map((orig) => {
          const word = round.options[orig];
          return (
            <TapCard key={orig} wrong={wrong === orig} onPick={() => pick(orig)} onHear={() => speak(word)} hearLabel={`Hear ${word}`} accent={accent}>
              <span className="font-fun text-xl font-700 text-slate-800">{word}</span>
            </TapCard>
          );
        })}
      </div>
      <RoundFeedback solved={solved} wrong={wrong != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && <PhonicsBuddy enabled resetKey={`listen-${round.word}`} req={{ type: "hint", game: "listen", word: round.word }} accent={accent} speak={speak} />}
    </div>
  );
}

function BlendGame({ rounds, accent, speak, play, buddy, onProgress, onFinish }: GameProps<BlendRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  // Bumped by "Blend it" to replay; reset each round so the first auto-play
  // (tick 0) gets its gentle lead-in delay.
  const [blendTick, setBlendTick] = useState(0);
  const round = rounds[index];
  const order = useMemo(() => round.options.map((_, i) => i).sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const sounds = useMemo(() => round.sounds.filter(Boolean), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;
  const { run: runSequence } = useSequencer();

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    setBlendTick(0);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  // Play the sounds in order on entry and on each "Blend it". A newer run cancels
  // a stale blend if the child advances mid-playback.
  useEffect(() => {
    runSequence(async (alive) => {
      await sleep(blendTick === 0 ? 350 : 0);
      for (const slug of sounds) {
        if (!alive()) return;
        await play(slug);
        if (!alive()) return;
        await sleep(BLEND_SOUND_GAP);
      }
    });
  }, [index, blendTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(orig: number) {
    if (wrong != null || solved) return;
    if (orig === round.answerIndex) {
      speak(round.options[orig].word);
      setSolved(true);
    } else {
      setWrong(orig);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="text-center font-round font-600 text-slate-500">Blend the sounds, then tap the picture!</p>
      {/* Tap a dot to hear that sound alone, or "Blend it" to hear them together. */}
      <div className={`flex w-full flex-col items-center gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <div className="flex justify-center gap-3.5">
          {sounds.map((slug, i) => (
            <button
              key={i}
              onClick={() => play(slug)}
              aria-label={`Sound ${i + 1}`}
              className={`flex h-16 w-16 items-center justify-center rounded-full ${a.soft} text-2xl shadow-sm transition hover:scale-105`}
            >
              🔊
            </button>
          ))}
        </div>
        <button onClick={() => setBlendTick((n) => n + 1)} className={`rounded-full ${a.solid} px-6 py-2.5 font-fun font-700 text-white shadow transition hover:scale-105`}>
          Blend it! 🔊
        </button>
      </div>
      {/* No letters shown — the word is decoded purely by ear. */}
      <div className="flex justify-center gap-3">
        {order.map((orig) => {
          const opt = round.options[orig];
          return (
            <button
              key={orig}
              onClick={() => pick(orig)}
              className={`flex w-28 flex-col items-center gap-1.5 rounded-3xl p-4 shadow-sm ring-1 transition ${wrong === orig ? "bg-coral/15 ring-coral/30" : "bg-white ring-slate-100 hover:scale-105"}`}
            >
              <span className="text-4xl">{opt.emoji}</span>
              <span className="font-fun text-sm font-700 text-slate-700">{opt.word}</span>
            </button>
          );
        })}
      </div>
      <RoundFeedback solved={solved} wrong={wrong != null} isLast={isLast} accent={accent} onNext={() => (isLast ? onFinish(mistakes) : setIndex(index + 1))} />
      {buddy && <PhonicsBuddy enabled resetKey={`blend-${round.word}`} req={{ type: "hint", game: "blend", word: round.word }} accent={accent} speak={speak} />}
    </div>
  );
}

function DigraphGame({ rounds, accent, speak, play, buddy, onProgress, onFinish }: GameProps<DigraphRound>) {
  const a = ACCENTS[accent];
  const [index, setIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const round = rounds[index];
  const order = useMemo(() => round.teams.map((_, i) => i).sort(() => Math.random() - 0.5), [index]); // eslint-disable-line react-hooks/exhaustive-deps
  const isLast = index + 1 >= rounds.length;

  useEffect(() => {
    onProgress(index, rounds.length);
    setSolved(false);
    const t = setTimeout(() => play(round.sound), 350);
    return () => clearTimeout(t);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (wrong == null) return;
    const t = setTimeout(() => setWrong(null), 1300);
    return () => clearTimeout(t);
  }, [wrong]);

  function pick(orig: number) {
    if (wrong != null || solved) return;
    if (orig === round.answerIndex) {
      speak(round.exampleWord);
      setSolved(true);
    } else {
      setWrong(orig);
      setMistakes((m) => m + 1);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <p className="text-center font-round font-600 text-slate-500">Which two letters make this sound?</p>
      {/* No word shown — the child must map the sound to its two-letter spelling. */}
      <div className={`flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 shadow-sm ring-1 ${a.ring}`}>
        <button onClick={() => play(round.sound)} className={`flex h-24 w-24 items-center justify-center rounded-full ${a.solid} text-5xl text-white shadow-lg transition hover:scale-105`}>
          🔊
        </button>
        <p className="font-round text-sm font-600 text-slate-400">Tap to hear again</p>
        {/* On a win, reinforce: the two letters → a word that uses them. */}
        {solved && (
          <div className="mt-1 flex items-center gap-2">
            <span className={`font-fun text-2xl font-700 ${a.text}`}>{round.teams[round.answerIndex]}</span>
            <span className="font-fun text-lg font-700 text-slate-400">→</span>
            <span className="text-2xl">{round.exampleEmoji}</span>
            <span className="font-fun text-lg font-700 text-slate-800">{round.exampleWord}</span>
          </div>
        )}
      </div>
      {/* A small speaker on each choice lets the child compare the teams. */}
      <div className="flex justify-center gap-3">
        {order.map((orig) => {
          const team = round.teams[orig];
          return (
            <TapCard key={orig} wrong={wrong === orig} onPick={() => pick(orig)} onHear={() => play(slugForTeam(team))} hearLabel={`Hear ${team}`} accent={accent} width="w-24">
              <span className="font-fun text-2xl font-700 text-slate-800">{team}</span>
            </TapCard>
          );
        })}
      </div>
      <RoundFeedback
        solved={solved}
        wrong={wrong != null}
        isLast={isLast}
        accent={accent}
        onNext={() => {
          if (isLast) return onFinish(mistakes);
          // Clear the win state in the SAME update as advancing — batched into one
          // re-render, so the next round never paints with the reinforcement panel
          // (which shows its answer) still open from this round.
          setSolved(false);
          setIndex(index + 1);
        }}
      />
      {buddy && (
        <PhonicsBuddy
          enabled
          resetKey={`digraph-${round.exampleWord}`}
          req={{ type: "hint", game: "digraph", word: round.exampleWord, team: round.teams[round.answerIndex] }}
          accent={accent}
          speak={speak}
        />
      )}
    </div>
  );
}

type GameProps<R> = {
  rounds: R[];
  accent: AccentKey;
  speak: (t: string) => void;
  /** Plays a phoneme clip; resolves when the sound finishes. */
  play: (slug: string) => Promise<void>;
  /** Cuts any playing clip/spoken word now (e.g. on leaving a round mid-sound-out). */
  stop: () => void;
  buddy: boolean;
  onProgress: (round: number, total: number) => void;
  onFinish: (mistakes: number) => void;
};

/* ============================ Stage host ============================ */

/** Canned praise per star tier, spoken and shown on clearing a world. Hardcoded
 *  on purpose: a celebration must be instant, and an LLM round-trip (~1s, or
 *  6-24s when the AI provider is rate-limited) is far too slow to cheer a child
 *  who has just finished. */
const PRAISE: Record<number, string> = {
  3: "Perfect! You cleared every round!",
  2: "Great job! You're getting really good at this!",
  1: "Well done! Keep practising and you'll be a superstar!",
};

function StageHost({ stage, speak, play, stop, buddy, onDone, onBack }: { stage: PhonicsStage; speak: (t: string) => void; play: (slug: string) => Promise<void>; stop: () => void; buddy: boolean; onDone: (stars: number) => void; onBack: () => void }) {
  const a = ACCENTS[stage.accent];
  const total = stageRounds(stage);
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [earned, setEarned] = useState<number | null>(null);

  function finish(mistakes: number) {
    const stars = starsForMistakes(mistakes);
    setEarned(stars);
    onDone(stars);
    speak(PRAISE[stars]);
  }

  const onProgress = useCallback((r: number, _t: number) => setRound(r), []);
  const gp = { accent: stage.accent, speak, play, stop, buddy, onProgress, onFinish: finish } as const;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="rounded-full bg-slate-100 px-4 py-2 font-fun text-sm font-700 text-slate-600 hover:bg-slate-200">
          ← Map
        </button>
        <div className="flex-1 text-center font-fun text-lg font-700 text-slate-800">
          {stage.emoji} {stage.title}
        </div>
        <div className="w-16" />
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <p className="font-round text-sm font-600 text-slate-400">Round {Math.min(round + 1, total)} of {total}</p>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${a.solid} transition-all`} style={{ width: `${(Math.min(round + 1, total) / total) * 100}%` }} />
        </div>
      </div>

      <div className="mt-6 flex min-h-[20rem] flex-col items-center justify-center">
        <div key={attempt} className="w-full">
          {stage.kind === "pop" && <PopGame rounds={stage.pop!} {...gp} />}
          {stage.kind === "build" && <BuildGame rounds={stage.build!} {...gp} />}
          {stage.kind === "rhyme" && <RhymeGame rounds={stage.rhyme!} {...gp} />}
          {stage.kind === "listen" && <ListenGame rounds={stage.listen!} {...gp} />}
          {stage.kind === "blend" && <BlendGame rounds={stage.blend!} {...gp} />}
          {stage.kind === "digraph" && <DigraphGame rounds={stage.digraph!} {...gp} />}
        </div>
      </div>

      {earned != null && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-xl ring-1 ring-amber-100">
            <div className="text-6xl">🎉</div>
            <h2 className="mt-2 font-fun text-2xl font-700 text-slate-900">{stage.title} cleared!</h2>
            <div className="mt-3 flex justify-center">
              <StarRow filled={earned} size="text-4xl" />
            </div>
            <p className={`mt-4 rounded-2xl ${a.soft} p-3 font-round text-sm font-600 text-slate-700`}>{PRAISE[earned]}</p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => {
                  setEarned(null);
                  setRound(0);
                  setAttempt((n) => n + 1);
                }}
                className="rounded-full bg-slate-100 px-5 py-2.5 font-fun font-700 text-slate-600 hover:bg-slate-200"
              >
                Play again 🔁
              </button>
              <button onClick={onBack} className={`rounded-full ${a.solid} px-5 py-2.5 font-fun font-700 text-white shadow`}>
                Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Adventure map ============================ */

export function PhonicsQuest({ initialStars }: { initialStars: Stars }) {
  const speak = useSpeaker();
  const { play, stop } = usePhonemePlayer();
  const [stars, setStars] = useState<Stars>(initialStars);
  const [selected, setSelected] = useState<number | null>(null);
  const [buddy, setBuddy] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    fetch("/api/learn/phonics-buddy")
      .then((r) => r.json())
      .then((d) => setBuddy(Boolean(d.enabled)))
      .catch(() => {});
    mounted.current = true;
  }, []);

  const totalStars = useMemo(() => Object.values(stars).reduce((n, v) => n + v, 0), [stars]);
  const isUnlocked = useCallback(
    (i: number) => i <= 0 || (stars[PHONICS_STAGES[i - 1].id] ?? 0) >= 1,
    [stars],
  );

  function recordStars(stageId: string, earned: number) {
    // Keep the best run only, and unlock the next world straight away — the POST
    // below is what persists it, and the server is the source of truth on the
    // next visit.
    setStars((prev) => (earned <= (prev[stageId] ?? 0) ? prev : { ...prev, [stageId]: earned }));
    // Contribute to global points / leaderboard (best-effort, fire-and-forget).
    fetch("/api/learn/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activitySlug: "ai-phonics", score: Math.round((earned / 3) * 100), metadata: { world: stageId, stars: earned } }),
    }).catch(() => {});
  }

  if (selected != null) {
    const stage = PHONICS_STAGES[selected];
    return (
      <StageHost
        stage={stage}
        speak={speak}
        play={play}
        stop={stop}
        buddy={buddy}
        onDone={(s) => recordStars(stage.id, s)}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <Link href="/learn" className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
          ← Back to activities
        </Link>
        <div className="inline-flex items-center gap-1 rounded-full bg-sunny/20 px-3 py-1 font-fun text-sm font-700 text-amber-600">
          ⭐ {totalStars}
        </div>
      </div>

      <div className="mt-3 rounded-[2rem] bg-gradient-to-r from-bubble/25 to-sky/25 p-6">
        <h1 className="font-fun text-3xl font-700 text-slate-900">🔤 Phonics Quest</h1>
        <p className="mt-1 font-round font-600 text-slate-600">Travel the worlds and master every sound!</p>
      </div>

      <div className="mt-4 grid gap-3">
        {PHONICS_STAGES.map((stage, i) => {
          const unlocked = isUnlocked(i);
          const a = ACCENTS[stage.accent];
          const earned = stars[stage.id] ?? 0;
          return (
            <button
              key={stage.id}
              onClick={() => unlocked && setSelected(i)}
              disabled={!unlocked}
              className={`flex items-center gap-4 rounded-3xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-100 transition ${unlocked ? "hover:-translate-y-0.5 hover:shadow-md" : "opacity-60"}`}
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl ${unlocked ? a.soft : "bg-slate-100"}`}>
                {unlocked ? stage.emoji : "🔒"}
              </div>
              <div className="flex-1">
                <div className={`font-fun font-700 ${unlocked ? "text-slate-900" : "text-slate-400"}`}>
                  World {i + 1} · {stage.title}
                </div>
                <div className="font-round text-sm text-slate-500">{unlocked ? stage.subtitle : "Clear the world before to unlock"}</div>
                {unlocked && (
                  <div className="mt-1">
                    <StarRow filled={earned} size="text-base" />
                  </div>
                )}
              </div>
              {unlocked && <div className={`font-fun text-xl font-700 ${a.text}`}>▶</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
